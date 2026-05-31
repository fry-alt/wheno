import { randomInt } from "node:crypto";
import { addDays, eachDayOfInterval, format, parseISO } from "date-fns";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { formatSlotDateTime, getDateRangeUtc, toUtcDateFromLocalParts } from "@/lib/datetime";
import { appError, getTranslations, type AppErrorKey } from "@/lib/i18n";
import { notifyParticipants } from "@/lib/notify";
import { calculateMeetingOptions } from "@/lib/scheduler";
import type { Language } from "@/lib/preferences-shared";
import type {
  AppUser,
  BusyBlockSummary,
  CalendarEvent,
  GroupDetail,
  GroupBusyBlockSummary,
  GroupListItem,
  GroupMemberSummary,
  MeetingDetail,
  MeetingMemberIdentity,
  MeetingOptionDetail,
  MeetingRequestSummary,
  PreferredTime,
  SchedulerBusyBlock,
  SchedulerMember,
  TelegramProfile,
  VoteSummary,
  VoteValue,
} from "@/lib/types";
import { getDisplayName } from "@/lib/utils";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildInviteCode(length = 6) {
  return Array.from({ length }, () =>
    INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)],
  ).join("");
}

function isUniqueViolation(code?: string | null) {
  return code === "23505";
}

const PREFERRED_TIMES = ["any", "morning", "afternoon", "evening"] as const;
const VOTE_VALUES = ["yes", "maybe", "no"] as const;

function assertSupabaseResult<T>(data: T | null, errorKey: AppErrorKey) {
  if (!data) {
    throw appError(errorKey);
  }

  return data;
}

export async function getUserById(userId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin.from("users").select("*").eq("id", userId).maybeSingle();

  if (error) {
    throw appError("user.loadProfileFailed");
  }

  return (data as AppUser | null) ?? null;
}

export async function upsertTelegramUser(profile: TelegramProfile) {
  const admin = getAdminSupabase();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        telegram_id: profile.telegramId,
        first_name: profile.firstName,
        last_name: profile.lastName,
        username: profile.username,
        photo_url: profile.photoUrl,
        timezone: profile.timezone,
        updated_at: now,
      },
      { onConflict: "telegram_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw appError("session.saveTelegramProfileFailed");
  }

  return data as AppUser;
}

export async function getGroupsForUser(userId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("group_members")
    .select(
      `
        role,
        group:groups (
          id,
          name,
          owner_id,
          invite_code,
          created_at
        )
      `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw appError("groups.loadFailed");
  }

  const memberships = ((data ?? []) as unknown as Array<{
    role: GroupListItem["role"];
    group:
      | Omit<GroupListItem, "role" | "member_count" | "open_meeting_count">
      | Array<Omit<GroupListItem, "role" | "member_count" | "open_meeting_count">>
      | null;
  }>)
    .map((entry) => ({
      ...entry,
      group: unwrapRelation(entry.group),
    }))
    .filter((entry) => entry.group);

  const groupIds = memberships.map((entry) => entry.group!.id);

  if (!groupIds.length) {
    return [] as GroupListItem[];
  }

  const [membersResult, meetingsResult] = await Promise.all([
    admin.from("group_members").select("group_id").in("group_id", groupIds),
    admin
      .from("meeting_requests")
      .select("group_id")
      .in("group_id", groupIds)
      .eq("status", "open"),
  ]);

  if (membersResult.error || meetingsResult.error) {
    throw appError("groups.loadFailed");
  }

  const members = membersResult.data;
  const meetings = meetingsResult.data;

  const memberCounts = new Map<string, number>();
  const meetingCounts = new Map<string, number>();

  for (const row of members) {
    memberCounts.set(row.group_id as string, (memberCounts.get(row.group_id as string) ?? 0) + 1);
  }

  for (const row of meetings) {
    meetingCounts.set(
      row.group_id as string,
      (meetingCounts.get(row.group_id as string) ?? 0) + 1,
    );
  }

  return memberships.map((membership) => ({
    ...membership.group!,
    role: membership.role,
    member_count: memberCounts.get(membership.group!.id) ?? 0,
    open_meeting_count: meetingCounts.get(membership.group!.id) ?? 0,
  }));
}

async function getGroupAccess(groupId: string, userId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("group_members")
    .select(
      `
        role,
        group:groups (
          id,
          name,
          owner_id,
          invite_code,
          created_at
        )
      `,
    )
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw appError("group.loadFailed");
  }

  return ((data as unknown) as
    | {
        role: GroupListItem["role"];
        group:
          | Omit<GroupDetail, "members" | "meeting_requests">
          | Array<Omit<GroupDetail, "members" | "meeting_requests">>
          | null;
      }
    | null)
    ? {
        ...(data as unknown as {
          role: GroupListItem["role"];
          group:
            | Omit<GroupDetail, "members" | "meeting_requests">
            | Array<Omit<GroupDetail, "members" | "meeting_requests">>
            | null;
        }),
        group: unwrapRelation(
          (data as unknown as {
            group:
              | Omit<GroupDetail, "members" | "meeting_requests">
              | Array<Omit<GroupDetail, "members" | "meeting_requests">>
              | null;
          }).group,
        ),
      }
    : null;
}

export async function getGroupMembers(groupId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("group_members")
    .select(
      `
        id,
        role,
        user:users (
          id,
          first_name,
          last_name,
          username,
          photo_url,
          timezone
        )
      `,
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    throw appError("group.membersLoadFailed");
  }

  return ((data ?? []) as unknown as Array<{
    id: string;
    role: GroupMemberSummary["role"];
    user: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      username: string | null;
      photo_url: string | null;
      timezone: string;
    } | Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      username: string | null;
      photo_url: string | null;
      timezone: string;
    }> | null;
  }>)
    .map((row) => ({
      ...row,
      user: unwrapRelation(row.user),
    }))
    .filter((row) => row.user)
    .map((row) => ({
      membership_id: row.id,
      role: row.role,
      user_id: row.user!.id,
      first_name: row.user!.first_name,
      last_name: row.user!.last_name,
      username: row.user!.username,
      photo_url: row.user!.photo_url,
      timezone: row.user!.timezone,
    }));
}

export async function getMeetingRequestSummaries(groupId: string) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw appError("meeting.requestsLoadFailed");
  }

  return (data ?? []) as MeetingRequestSummary[];
}

export async function getGroupDetailForUser(groupId: string, userId: string) {
  const access = await getGroupAccess(groupId, userId);

  if (!access?.group) {
    return null;
  }

  const [members, meetingRequests] = await Promise.all([
    getGroupMembers(groupId),
    getMeetingRequestSummaries(groupId),
  ]);

  return {
    ...access.group,
    members,
    meeting_requests: meetingRequests,
  } satisfies GroupDetail;
}

const MAX_NAME_LENGTH = 80;
const MAX_MEETING_DURATION_MINUTES = 480;
const MAX_MEETING_DATE_RANGE_DAYS = 90;
const MAX_BUSY_DATE_RANGE_DAYS = 365;

export async function createGroupForUser(userId: string, name: string) {
  const admin = getAdminSupabase();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw appError("group.nameRequired");
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    throw appError("group.nameTooLong");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = buildInviteCode();
    const { data, error } = await admin
      .from("groups")
      .insert({
        name: trimmedName,
        owner_id: userId,
        invite_code: inviteCode,
      })
      .select("id")
      .single();

    if (error) {
      if (isUniqueViolation(error.code)) {
        continue;
      }

      throw appError("group.createFailed");
    }

    const group = assertSupabaseResult(data, "group.createFailed");
    const { error: memberError } = await admin.from("group_members").insert({
      group_id: group.id,
      user_id: userId,
      role: "owner",
    });

    if (memberError) {
      throw appError("group.ownerMembershipFailed");
    }

    return group.id as string;
  }

  throw appError("group.inviteCodeFailed");
}

export async function joinGroupByInviteCode(userId: string, inviteCode: string) {
  const admin = getAdminSupabase();
  const normalizedCode = inviteCode.trim().toUpperCase();

  if (!normalizedCode) {
    throw appError("group.inviteCodeRequired");
  }

  const { data: group, error: groupError } = await admin
    .from("groups")
    .select("id")
    .eq("invite_code", normalizedCode)
    .maybeSingle();

  if (groupError) {
    throw appError("group.inviteCodeCheckFailed");
  }

  if (!group) {
    throw appError("group.inviteCodeInvalid");
  }

  const { error: memberError } = await admin.from("group_members").insert({
    group_id: group.id,
    user_id: userId,
    role: "member",
  });

  if (memberError && !isUniqueViolation(memberError.code)) {
    throw appError("group.joinFailed");
  }

  return group.id as string;
}

export async function createBusyBlockForUser({
  userId,
  title,
  date,
  startTime,
  endTime,
  timezone,
}: {
  userId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}) {
  const admin = getAdminSupabase();
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw appError("busyBlock.titleRequired");
  }

  if (trimmedTitle.length > MAX_NAME_LENGTH) {
    throw appError("busyBlock.titleTooLong");
  }

  const startAt = toUtcDateFromLocalParts(date, startTime, timezone);
  const endAt = toUtcDateFromLocalParts(date, endTime, timezone);

  if (endAt <= startAt) {
    throw appError("busyBlock.invalidTimeRange");
  }

  const { error } = await admin.from("busy_blocks").insert({
    user_id: userId,
    title: trimmedTitle,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    source: "manual",
  });

  if (error) {
    throw appError("busyBlock.saveFailed");
  }
}

export async function createWeeklyBusyBlocksForUser({
  userId,
  title,
  startDate,
  endDate,
  weekdays,
  startTime,
  endTime,
  timezone,
}: {
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  timezone: string;
}) {
  const admin = getAdminSupabase();
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw appError("busyBlock.titleRequired");
  }

  if (trimmedTitle.length > MAX_NAME_LENGTH) {
    throw appError("busyBlock.titleTooLong");
  }

  if (endDate < startDate) {
    throw appError("busyBlock.invalidDateRange");
  }

  const rangeDays =
    (parseISO(endDate).getTime() - parseISO(startDate).getTime()) /
    (1000 * 60 * 60 * 24);

  if (rangeDays > MAX_BUSY_DATE_RANGE_DAYS) {
    throw appError("busyBlock.dateRangeTooLarge");
  }

  const uniqueWeekdays = Array.from(new Set(weekdays)).filter((weekday) => weekday >= 0 && weekday <= 6);

  if (!uniqueWeekdays.length) {
    throw appError("busyBlock.weekdayRequired");
  }

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).filter((day) => uniqueWeekdays.includes(day.getDay()));

  if (!days.length) {
    throw appError("busyBlock.noMatchingWeekdays");
  }

  const rows = days.map((day) => {
    const date = format(day, "yyyy-MM-dd");
    const startAt = toUtcDateFromLocalParts(date, startTime, timezone);
    const endAt = toUtcDateFromLocalParts(date, endTime, timezone);

    if (endAt <= startAt) {
      throw appError("busyBlock.invalidTimeRange");
    }

    return {
      user_id: userId,
      title: trimmedTitle,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      source: "manual",
    };
  });

  const { error } = await admin.from("busy_blocks").insert(rows);

  if (error) {
    throw appError("busyBlock.saveFailed");
  }
}

export async function getBusyBlocksForUserInRange({
  userId,
  startAt,
  endAt,
}: {
  userId: string;
  startAt: Date;
  endAt: Date;
}) {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("busy_blocks")
    .select("id, title, start_at, end_at, source")
    .eq("user_id", userId)
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .order("start_at", { ascending: true });

  if (error) {
    throw appError("busyBlock.loadFailed");
  }

  return (data ?? []) as BusyBlockSummary[];
}

export async function getBusyBlocksForUsersInRange({
  userIds,
  startAt,
  endAt,
}: {
  userIds: string[];
  startAt: Date;
  endAt: Date;
}) {
  if (!userIds.length) {
    return [] as GroupBusyBlockSummary[];
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("busy_blocks")
    .select("id, user_id, title, start_at, end_at, source")
    .in("user_id", userIds)
    .lt("start_at", endAt.toISOString())
    .gt("end_at", startAt.toISOString())
    .order("start_at", { ascending: true });

  if (error) {
    throw appError("busyBlock.loadFailed");
  }

  return (data ?? []) as GroupBusyBlockSummary[];
}

export async function createMeetingRequestWithOptions({
  groupId,
  userId,
  title,
  dateFrom,
  dateTo,
  durationMinutes,
  preferredTime,
  minParticipants,
  timezone,
}: {
  groupId: string;
  userId: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  durationMinutes: number;
  preferredTime: PreferredTime;
  minParticipants: number;
  timezone: string;
}) {
  const admin = getAdminSupabase();
  const groupDetail = await getGroupDetailForUser(groupId, userId);

  if (!groupDetail) {
    throw appError("meeting.groupNotFound");
  }

  if (groupDetail.owner_id !== userId) {
    throw appError("meeting.ownerOnly");
  }

  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw appError("meeting.titleRequired");
  }

  if (trimmedTitle.length > MAX_NAME_LENGTH) {
    throw appError("meeting.titleTooLong");
  }

  if (dateTo < dateFrom) {
    throw appError("meeting.invalidDateRange");
  }

  const meetingRangeDays =
    (parseISO(dateTo).getTime() - parseISO(dateFrom).getTime()) /
    (1000 * 60 * 60 * 24);

  if (meetingRangeDays > MAX_MEETING_DATE_RANGE_DAYS) {
    throw appError("meeting.dateRangeTooLarge");
  }

  if (durationMinutes <= 0) {
    throw appError("meeting.invalidDuration");
  }

  if (durationMinutes > MAX_MEETING_DURATION_MINUTES) {
    throw appError("meeting.durationTooLong");
  }

  if (
    minParticipants < 1 ||
    minParticipants > groupDetail.members.length ||
    !PREFERRED_TIMES.includes(preferredTime)
  ) {
    throw appError("meeting.invalidParticipants");
  }

  const { data: request, error: requestError } = await admin
    .from("meeting_requests")
    .insert({
      group_id: groupId,
      created_by: userId,
      title: trimmedTitle,
      date_from: dateFrom,
      date_to: dateTo,
      duration_minutes: durationMinutes,
      preferred_time: preferredTime,
      min_participants: minParticipants,
      status: "open",
    })
    .select("id")
    .single();

  if (requestError) {
    throw appError("meeting.createFailed");
  }

  const meetingRequestId = String(request.id);

  const { start, end } = getDateRangeUtc(dateFrom, dateTo, timezone);
  const memberIds = groupDetail.members.map((member) => member.user_id);

  const { data: busyRows, error: busyError } = await admin
    .from("busy_blocks")
    .select("id, user_id, title, start_at, end_at")
    .in("user_id", memberIds)
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());

  if (busyError) {
    throw appError("meeting.busyBlocksLoadFailed");
  }

  const options = calculateMeetingOptions({
    members: groupDetail.members.map(
      (member) =>
        ({
          userId: member.user_id,
        }) satisfies SchedulerMember,
    ),
    busyBlocks: ((busyRows ?? []) as Array<{
      id: string;
      user_id: string;
      title: string;
      start_at: string;
      end_at: string;
    }>).map(
      (busyBlock) =>
        ({
          id: busyBlock.id,
          userId: busyBlock.user_id,
          title: busyBlock.title,
          startAt: busyBlock.start_at,
          endAt: busyBlock.end_at,
        }) satisfies SchedulerBusyBlock,
    ),
    dateFrom,
    dateTo,
    durationMinutes,
    preferredTime,
    minParticipants,
    timezone,
  });

  if (!options.length) {
    await admin.from("meeting_requests").delete().eq("id", meetingRequestId);
    throw appError("meeting.noSlots");
  }

  const { error: optionsError } = await admin.from("meeting_options").insert(
    options.map((option) => ({
      meeting_request_id: meetingRequestId,
      start_at: option.startAt,
      end_at: option.endAt,
      score: option.score,
      free_user_ids: option.freeUserIds,
      busy_user_ids: option.busyUserIds,
    })),
  );

  if (optionsError) {
    throw appError("meeting.optionsSaveFailed");
  }

  return meetingRequestId;
}

export async function getMeetingDetailForUser(meetingId: string, userId: string) {
  const admin = getAdminSupabase();
  const { data: meeting, error: meetingError } = await admin
    .from("meeting_requests")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (meetingError) {
    throw appError("meeting.loadFailed");
  }

  if (!meeting) {
    return null;
  }

  const meetingRow = meeting as {
    id: string;
    group_id: string;
    title: string;
    date_from: string;
    date_to: string;
    duration_minutes: number;
    preferred_time: PreferredTime;
    min_participants: number;
    status: MeetingDetail["status"];
    selected_option_id: string | null;
  };

  const groupDetail = await getGroupDetailForUser(meetingRow.group_id, userId);

  if (!groupDetail) {
    return null;
  }

  const { data: options, error: optionsError } = await admin
    .from("meeting_options")
    .select("*")
    .eq("meeting_request_id", meetingId)
    .order("score", { ascending: false })
    .order("start_at", { ascending: true });

  if (optionsError) {
    throw appError("meeting.optionsLoadFailed");
  }

  const optionRows = (options ?? []) as Array<{
    id: string;
    start_at: string;
    end_at: string;
    score: number;
    free_user_ids: string[];
    busy_user_ids: string[];
  }>;
  const optionIds = optionRows.map((option) => option.id);
  const { data: votes, error: votesError } = optionIds.length
    ? await admin.from("votes").select("option_id, user_id, vote").in("option_id", optionIds)
    : { data: [], error: null };

  if (votesError) {
    throw appError("meeting.votesLoadFailed");
  }

  const memberDirectory = new Map(
    groupDetail.members.map((member) => [
      member.user_id,
      {
        user_id: member.user_id,
        name: getDisplayName(member),
        photo_url: member.photo_url,
      } satisfies MeetingMemberIdentity,
    ]),
  );
  const votesByOption = new Map<string, VoteSummary>();
  const currentVoteByOption = new Map<string, VoteValue | null>();

  for (const vote of (votes ?? []) as Array<{
    option_id: string;
    user_id: string;
    vote: VoteValue;
  }>) {
    const summary = votesByOption.get(vote.option_id) ?? {
      yes: 0,
      maybe: 0,
      no: 0,
    };

    summary[vote.vote] += 1;
    votesByOption.set(vote.option_id, summary);

    if (vote.user_id === userId) {
      currentVoteByOption.set(vote.option_id, vote.vote);
    }
  }

  const mappedOptions = optionRows.map(
    (option) =>
      ({
        id: option.id,
        start_at: option.start_at,
        end_at: option.end_at,
        score: option.score,
        free_user_ids: option.free_user_ids,
        busy_user_ids: option.busy_user_ids,
        free_members: option.free_user_ids.map(
          (id) =>
            memberDirectory.get(id) ?? {
              user_id: id,
              name: "Unknown",
              photo_url: null,
            },
        ),
        busy_members: option.busy_user_ids.map(
          (id) =>
            memberDirectory.get(id) ?? {
              user_id: id,
              name: "Unknown",
              photo_url: null,
            },
        ),
        votes: votesByOption.get(option.id) ?? {
          yes: 0,
          maybe: 0,
          no: 0,
        },
        current_user_vote: currentVoteByOption.get(option.id) ?? null,
      }) satisfies MeetingOptionDetail,
  );

  return {
    id: meetingRow.id,
    group_id: meetingRow.group_id,
    group_name: groupDetail.name,
    group_owner_id: groupDetail.owner_id,
    title: meetingRow.title,
    date_from: meetingRow.date_from,
    date_to: meetingRow.date_to,
    duration_minutes: meetingRow.duration_minutes,
    preferred_time: meetingRow.preferred_time,
    min_participants: meetingRow.min_participants,
    status: meetingRow.status,
    selected_option_id: meetingRow.selected_option_id,
    member_count: groupDetail.members.length,
    options: mappedOptions,
  } satisfies MeetingDetail;
}

async function getMeetingForMemberAction(meetingId: string, userId: string) {
  const detail = await getMeetingDetailForUser(meetingId, userId);

  if (!detail) {
    throw appError("meeting.notFound");
  }

  return detail;
}

export async function saveVoteForOption({
  meetingId,
  optionId,
  userId,
  vote,
}: {
  meetingId: string;
  optionId: string;
  userId: string;
  vote: VoteValue;
}) {
  const admin = getAdminSupabase();
  const meeting = await getMeetingForMemberAction(meetingId, userId);

  if (!VOTE_VALUES.includes(vote)) {
    throw appError("meeting.voteSaveFailed");
  }

  const option = meeting.options.find((item) => item.id === optionId);

  if (!option) {
    throw appError("meeting.optionMissing");
  }

  const { error } = await admin.from("votes").upsert(
    {
      option_id: optionId,
      user_id: userId,
      vote,
    },
    { onConflict: "option_id,user_id" },
  );

  if (error) {
    throw appError("meeting.voteSaveFailed");
  }
}

export async function selectMeetingOptionForOwner({
  meetingId,
  optionId,
  userId,
  language = "en",
}: {
  meetingId: string;
  optionId: string;
  userId: string;
  language?: Language;
}) {
  const admin = getAdminSupabase();
  const meeting = await getMeetingForMemberAction(meetingId, userId);

  if (meeting.group_owner_id !== userId) {
    throw appError("meeting.selectOwnerOnly");
  }

  const option = meeting.options.find((item) => item.id === optionId);

  if (!option) {
    throw appError("meeting.optionMissing");
  }

  const { error } = await admin
    .from("meeting_requests")
    .update({
      status: "selected",
      selected_option_id: optionId,
    })
    .eq("id", meetingId);

  if (error) {
    throw appError("meeting.selectFailed");
  }

  // Notify all group members via bot DM (non-blocking, errors are logged not thrown)
  try {
    const { data: members } = await admin
      .from("group_members")
      .select("user:users(telegram_id)")
      .eq("group_id", meeting.group_id);

    if (members?.length) {
      const copy = getTranslations(language);
      const slot = formatSlotDateTime(option.start_at, option.end_at, "UTC", language);
      const text = copy.meeting.notifyMessage(
        meeting.group_name,
        meeting.title,
        slot.date,
        slot.time,
      );

      const participants = (members as Array<{ user: { telegram_id: string } | Array<{ telegram_id: string }> | null }>)
        .map((m) => (Array.isArray(m.user) ? m.user[0] : m.user))
        .filter((u): u is { telegram_id: string } => u !== null && u !== undefined);

      await notifyParticipants(participants, text);
    }
  } catch {
    // Notification failure must not break slot selection
  }
}

// ─── Inline availability grid ─────────────────────────────────────────────

export type HalfDay = "morning" | "afternoon" | "evening";

const HALF_DAY_TIMES: Record<HalfDay, { start: string; end: string }> = {
  morning:   { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening:   { start: "17:00", end: "22:00" },
};

export interface InlineBusyCell {
  date: string;   // "yyyy-MM-dd"
  period: HalfDay;
}

export async function getInlineBusyCells(
  userId: string,
  weekStart: string,
  timezone: string,
): Promise<InlineBusyCell[]> {
  const admin = getAdminSupabase();
  const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
  const { start, end } = getDateRangeUtc(weekStart, weekEnd, timezone);

  const { data, error } = await admin
    .from("busy_blocks")
    .select("start_at, end_at")
    .eq("user_id", userId)
    .eq("source", "inline")
    .lt("start_at", end.toISOString())
    .gt("end_at", start.toISOString());

  if (error) {
    return [];
  }

  const cells: InlineBusyCell[] = [];
  const days = eachDayOfInterval({ start: parseISO(weekStart), end: parseISO(weekEnd) });

  for (const day of days) {
    const date = format(day, "yyyy-MM-dd");

    for (const [period, times] of Object.entries(HALF_DAY_TIMES) as [HalfDay, { start: string; end: string }][]) {
      const cellStart = toUtcDateFromLocalParts(date, times.start, timezone);
      const cellEnd   = toUtcDateFromLocalParts(date, times.end,   timezone);

      const occupied = (data ?? []).some((block) => {
        const bs = new Date(block.start_at as string);
        const be = new Date(block.end_at as string);
        return bs < cellEnd && be > cellStart;
      });

      if (occupied) {
        cells.push({ date, period });
      }
    }
  }

  return cells;
}

export async function toggleInlineBusyCell(
  userId: string,
  date: string,
  period: HalfDay,
  timezone: string,
  currentlyCells: InlineBusyCell[],
): Promise<void> {
  const admin = getAdminSupabase();
  const times = HALF_DAY_TIMES[period];
  const isBusy = currentlyCells.some((c) => c.date === date && c.period === period);

  if (isBusy) {
    const cellStart = toUtcDateFromLocalParts(date, times.start, timezone);
    const cellEnd   = toUtcDateFromLocalParts(date, times.end,   timezone);

    const { error } = await admin
      .from("busy_blocks")
      .delete()
      .eq("user_id", userId)
      .eq("source", "inline")
      .gte("start_at", cellStart.toISOString())
      .lte("end_at", cellEnd.toISOString());

    if (error) {
      throw appError("busyBlock.toggleFailed");
    }
  } else {
    const startAt = toUtcDateFromLocalParts(date, times.start, timezone);
    const endAt   = toUtcDateFromLocalParts(date, times.end,   timezone);

    const { error } = await admin.from("busy_blocks").insert({
      user_id:  userId,
      title:    period,
      start_at: startAt.toISOString(),
      end_at:   endAt.toISOString(),
      source:   "inline",
    });

    if (error) {
      throw appError("busyBlock.toggleFailed");
    }
  }
}

export async function getCalendarEventsForUserInRange({
  userId,
  startAt,
  endAt,
}: {
  userId: string;
  startAt: string;
  endAt: string;
}): Promise<CalendarEvent[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_events")
    .select("id, user_id, title, activity_type, starts_at, ends_at, location, energy_after, dress_code, is_flexible, notes, source, created_at")
    .eq("user_id", userId)
    .gte("starts_at", startAt)
    .lte("starts_at", endAt)
    .order("starts_at", { ascending: true });
  return (data ?? []) as CalendarEvent[];
}
