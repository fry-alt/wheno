import type { Language } from "@/lib/preferences-shared";

export type AppErrorKey =
  | "auth.openFromTelegramAgain"
  | "user.loadProfileFailed"
  | "session.saveTelegramProfileFailed"
  | "groups.loadFailed"
  | "group.loadFailed"
  | "group.membersLoadFailed"
  | "meeting.requestsLoadFailed"
  | "group.nameRequired"
  | "group.nameTooLong"
  | "group.createFailed"
  | "group.ownerMembershipFailed"
  | "group.inviteCodeFailed"
  | "group.inviteCodeRequired"
  | "group.inviteCodeCheckFailed"
  | "group.inviteCodeInvalid"
  | "group.joinFailed"
  | "busyBlock.titleRequired"
  | "busyBlock.titleTooLong"
  | "busyBlock.invalidDateRange"
  | "busyBlock.dateRangeTooLarge"
  | "busyBlock.invalidTimeRange"
  | "busyBlock.weekdayRequired"
  | "busyBlock.noMatchingWeekdays"
  | "busyBlock.loadFailed"
  | "busyBlock.saveFailed"
  | "busyBlock.toggleFailed"
  | "meeting.groupNotFound"
  | "meeting.ownerOnly"
  | "meeting.titleRequired"
  | "meeting.titleTooLong"
  | "meeting.invalidDateRange"
  | "meeting.dateRangeTooLarge"
  | "meeting.invalidDuration"
  | "meeting.durationTooLong"
  | "meeting.invalidParticipants"
  | "meeting.createFailed"
  | "meeting.busyBlocksLoadFailed"
  | "meeting.noSlots"
  | "meeting.optionsSaveFailed"
  | "meeting.loadFailed"
  | "meeting.optionsLoadFailed"
  | "meeting.votesLoadFailed"
  | "meeting.notFound"
  | "meeting.optionMissing"
  | "meeting.voteSaveFailed"
  | "meeting.selectOwnerOnly"
  | "meeting.selectFailed"
  | "telegram.userMissing"
  | "telegram.miniAppCredentialsMissing"
  | "telegram.openFromMiniAppButton"
  | "session.openFailed"
  | "generic.unexpected";

type ErrorValues = Record<string, number | string | undefined>;

export class AppError extends Error {
  constructor(
    public key: AppErrorKey,
    public values: ErrorValues = {},
  ) {
    super(key);
    this.name = "AppError";
  }
}

export function appError(key: AppErrorKey, values?: ErrorValues) {
  return new AppError(key, values);
}

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

function pluralizeRu(count: number, [one, few, many]: [string, string, string]) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function withCount(
  language: Language,
  count: number,
  en: [string, string],
  ru: [string, string, string],
) {
  const noun = language === "ru" ? pluralizeRu(count, ru) : count === 1 ? en[0] : en[1];
  return `${count} ${noun}`;
}

function getNouns(language: Language) {
  return {
    members: (count: number) =>
      withCount(language, count, ["member", "members"], [
        "участник",
        "участника",
        "участников",
      ]),
    participants: (count: number) =>
      withCount(language, count, ["participant", "participants"], [
        "участник",
        "участника",
        "участников",
      ]),
    meetingRequests: (count: number) =>
      withCount(language, count, ["meeting request", "meeting requests"], [
        "запрос",
        "запроса",
        "запросов",
      ]),
    options: (count: number) =>
      withCount(language, count, ["option", "options"], [
        "вариант",
        "варианта",
        "вариантов",
      ]),
    freeMembers: (count: number) =>
      withCount(language, count, ["free member", "free members"], [
        "свободный участник",
        "свободных участника",
        "свободных участников",
      ]),
    busyMembers: (count: number) =>
      withCount(language, count, ["busy member", "busy members"], [
        "занятый участник",
        "занятых участника",
        "занятых участников",
      ]),
  };
}

export function getTranslations(language: Language) {
  const nouns = getNouns(language);

  if (language === "ru") {
    return {
      language,
      nouns,
      shell: {
        productLabel: "telegram mini app",
        productDescription: "Планирование встреч внутри Telegram.",
        signedInAs: "вы вошли как",
        themeLabel: "тема",
        languageLabel: "язык",
        themeLight: "светлая",
        themeDark: "тёмная",
        languageEnglish: "EN",
        languageRussian: "RU",
      },
      common: {
        backHome: "На главную",
        backToGroup: "К группе",
        cancel: "Отмена",
        create: "Создать",
        join: "Войти",
        tryAgain: "Повторить",
        shareLink: "Поделиться ссылкой",
        linkCopied: "Ссылка скопирована",
        copyInviteLink: "Скопировать ссылку",
      copyUnavailable: "Не удалось скопировать",
      total: "всего",
      score: "оценка",
      owner: "владелец",
      member: "участник",
      open: "открыт",
      selected: "выбран",
      minuteShort: "мин",
      yes: "да",
      maybe: "может быть",
      no: "нет",
        inviteCode: "Код приглашения",
        shareThisLink: "Поделитесь этой ссылкой",
        openGroup: "Открыть группу",
        openCalendar: "Мой календарь",
        selectedSlot: "Этот слот уже выбран как финальный.",
        selectThisSlot: "Выбрать этот слот",
        noOneFree: "Никто не свободен.",
        everyoneFree: "Все свободны.",
        voteSummary: (yes: number, maybe: number, no: number) =>
          `Голоса: ${yes} да · ${maybe} может быть · ${no} нет`,
      },
      home: {
        splashTitle: "Найдите лучшее время вместе",
        splashDescription: "Подключим ваш Telegram-профиль и загрузим ваши группы.",
        title: "Ваши группы",
        description:
          "Создайте группу, поделитесь приглашением, добавьте занятые окна и дайте wheno предложить лучшие слоты.",
        createGroup: "Создать группу",
        joinGroup: "Войти по коду",
        emptyTitle: "Пока нет групп",
        emptyDescription:
          "Начните с одной компании друзей, а потом пригласите остальных коротким кодом.",
        emptyAction: "Создать первую группу",
      },
      createGroup: {
        title: "Создать группу",
        splashDescription: "Сначала нужен ваш Telegram-сеанс, чтобы создать группу.",
        description: "Выберите короткое и понятное имя, которое узнают друзья.",
        nameLabel: "Название группы",
        namePlaceholder: "Ужин в пятницу",
        submit: "Создать",
        pending: "Создаём группу...",
      },
      join: {
        title: "Войти в группу",
        splashDescription:
          "Сначала подключим ваш Telegram-сеанс, а потом вы сможете войти по коду.",
        description: "Вставьте код приглашения, которым поделился друг.",
        codeLabel: "Код приглашения",
        codePlaceholder: "AB12CD",
        submit: "Войти",
        pending: "Входим в группу...",
      },
      availability: {
        title: "Добавить занятое время",
        splashDescription:
          "Сначала нужен ваш Telegram-сеанс, чтобы сохранить занятое время.",
        description: "Добавьте интервал, в который вы точно не сможете.",
        modeQuick: "Быстро",
        modeManual: "Вручную",
        modeWeekly: "Еженедельно",
        quickDateLabel: "Дата",
        quickPresetLabel: "Шаблон",
        manualTitle: "Разовый занятый интервал",
        weeklyTitle: "Повторять каждую неделю",
        titleLabel: "Название",
        titlePlaceholder: "Рабочий звонок",
        dateLabel: "Дата",
        startDateLabel: "С даты",
        endDateLabel: "По дату",
        startLabel: "Начало",
        endLabel: "Конец",
        weekdaysLabel: "Дни недели",
        submit: "Сохранить блок",
        pending: "Сохраняем...",
        quickPresets: {
          lunch: "Обед",
          workday: "Работа",
          evening: "Вечер",
        },
        weekdays: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
      },
      calendar: {
        title: "Мой календарь",
        splashDescription:
          "Сначала нужен ваш Telegram-сеанс, чтобы показать личный календарь.",
        description: "Ваши занятые интервалы на ближайшую неделю.",
        addBusyTime: "Добавить занятость",
        upcomingTitle: "Ближайшие блоки",
        weekTitle: "Неделя",
        emptyTitle: "Пока нет занятых блоков",
        emptyDescription:
          "Добавьте разовые или еженедельные интервалы, и они появятся здесь.",
        hoursLabel: "часы",
        freeDay: "Свободно",
      },
      group: {
        loadingTitle: "Загружаем группу",
        splashDescription: "Подключим ваш Telegram-сеанс и загрузим эту группу.",
        description:
          "Пригласите друзей, добавьте занятые интервалы и создайте запрос на встречу, когда все будут внутри.",
        addBusyTime: "Добавить занятость",
        findTime: "Найти время",
        membersTitle: "Участники",
        availabilityTitle: "Календарь занятости",
        availabilityDescription: "Занятые интервалы участников на ближайшую неделю.",
        availabilityEmptyDay: "Свободно",
        availabilityNoBlocks: "На этой неделе пока нет занятых интервалов.",
        availabilityBlocks: "блоков",
        myAvailabilityTitle: "Моя занятость на этой неделе",
        myAvailabilityHint: "Нажмите на ячейку, чтобы отметить или снять занятость.",
        gridMorning: "Утро",
        gridAfternoon: "День",
        gridEvening: "Вечер",
        meetingRequestsTitle: "Запросы на встречу",
        noMeetingsTitle: "Пока нет запросов",
        noMeetingsOwnerDescription:
          "Когда все добавят занятые интервалы, попросите wheno предложить лучшие слоты.",
        noMeetingsMemberDescription:
          "Владелец группы сможет создать запрос на встречу, когда все поделятся доступностью.",
        createMeetingRequest: "Создать запрос",
      },
      findTime: {
        title: "Найти время",
        splashDescription: "Подключим ваш Telegram-сеанс и загрузим планировщик.",
        description:
          "Задайте диапазон дат, а wheno предложит самые сильные общие слоты.",
        ownerOnly:
          "Только владелец группы может создавать запросы на встречу для этой группы.",
        membersAvailable: (count: number) =>
          `${nouns.members(count)} можно учитывать при расчёте.`,
        membersLimit: (count: number) =>
          `Минимум участников не может быть больше, чем ${count}.`,
        titleLabel: "Название встречи",
        titlePlaceholder: "Ужин на следующей неделе",
        fromLabel: "С даты",
        toLabel: "По дату",
        durationLabel: "Длительность (минуты)",
        minParticipantsLabel: "Минимум участников",
        preferredTimeLabel: "Предпочтительное время дня",
        anyTime: "Любое время",
        morning: "Утро",
        afternoon: "День",
        evening: "Вечер",
        submit: "Найти лучшие слоты",
        pending: "Считаем варианты...",
      },
      meeting: {
        loadingTitle: "Загружаем встречу",
        splashDescription: "Подключим ваш Telegram-сеанс и загрузим варианты встречи.",
        description:
          "Голосуйте за подходящие варианты, а если вы владелец группы — зафиксируйте финальный слот.",
        noOptionsTitle: "Пока нет вариантов",
        noOptionsDescription: "Для этого запроса пока не найдено подходящих слотов.",
        summary: (range: string, duration: number, participants: number) =>
          `${range} · ${duration} мин · минимум ${nouns.participants(participants)}`,
        freeOf: (free: number, total: number) => `${free} из ${total} свободны`,
        notifyMessage: (groupName: string, title: string, date: string, time: string) =>
          `✅ <b>${groupName}</b>\nВстреча «${title}» назначена!\n📅 ${date}\n🕐 ${time}`,
      },
      session: {
        checkingProfile: "Проверяем ваш Telegram-профиль.",
        opening: "Открываем wheno",
        errorTitle: "Пока не удалось открыть wheno",
      },
      loading: {
        title: "Открываем wheno",
        description: "Подготавливаем ваши группы и запросы на встречу.",
      },
      notFound: {
        title: "Здесь ничего нет",
        description: "Страница, которую вы искали, больше недоступна.",
        emptyTitle: "Мы не нашли эту страницу",
        emptyDescription:
          "Группа или встреча могли переместиться, либо вам нужно сначала в неё вступить.",
      },
      errorPage: {
        title: "Что-то пошло не так",
        description: "На этом экране произошла неожиданная ошибка.",
        fallback: "Попробуйте ещё раз через минуту.",
      },
      errors: {
        "auth.openFromTelegramAgain": () => "Пожалуйста, откройте wheno из Telegram ещё раз.",
        "user.loadProfileFailed": () => "Сейчас не удалось загрузить ваш профиль.",
        "session.saveTelegramProfileFailed": () =>
          "Пока не удалось сохранить ваш Telegram-профиль.",
        "groups.loadFailed": () => "Сейчас не удалось загрузить ваши группы.",
        "group.loadFailed": () => "Сейчас не удалось загрузить эту группу.",
        "group.membersLoadFailed": () => "Пока не удалось загрузить участников группы.",
        "meeting.requestsLoadFailed": () =>
          "Пока не удалось загрузить запросы на встречу.",
        "group.nameRequired": () => "Пожалуйста, введите название группы.",
        "group.nameTooLong": () => "Название группы не должно превышать 80 символов.",
        "group.createFailed": () => "Пока не удалось создать группу.",
        "group.ownerMembershipFailed": () =>
          "Группа создана, но не удалось добавить вас владельцем.",
        "group.inviteCodeFailed": () =>
          "Сейчас не удалось сгенерировать код приглашения. Попробуйте ещё раз.",
        "group.inviteCodeRequired": () => "Введите код приглашения.",
        "group.inviteCodeCheckFailed": () =>
          "Пока не удалось проверить этот код приглашения.",
        "group.inviteCodeInvalid": () => "Такой код приглашения не найден.",
        "group.joinFailed": () => "Пока не удалось войти в группу.",
        "busyBlock.titleRequired": () => "Пожалуйста, назовите этот занятый интервал.",
        "busyBlock.titleTooLong": () => "Название занятого интервала не должно превышать 80 символов.",
        "busyBlock.invalidDateRange": () =>
          "Конечная дата должна быть позже начальной.",
        "busyBlock.dateRangeTooLarge": () =>
          "Диапазон дат не должен превышать 365 дней.",
        "busyBlock.invalidTimeRange": () =>
          "Время окончания должно быть позже времени начала.",
        "busyBlock.weekdayRequired": () => "Выберите хотя бы один день недели.",
        "busyBlock.noMatchingWeekdays": () =>
          "В выбранном диапазоне нет подходящих дней недели.",
        "busyBlock.loadFailed": () =>
          "Пока не удалось загрузить ваши занятые интервалы.",
        "busyBlock.saveFailed": () => "Пока не удалось сохранить этот занятый интервал.",
        "busyBlock.toggleFailed": () => "Не удалось обновить занятость. Попробуйте ещё раз.",
        "meeting.groupNotFound": () => "Не удалось найти эту группу.",
        "meeting.ownerOnly": () =>
          "Только владелец группы может создать запрос на встречу.",
        "meeting.titleRequired": () => "Пожалуйста, введите название встречи.",
        "meeting.titleTooLong": () => "Название встречи не должно превышать 80 символов.",
        "meeting.invalidDateRange": () =>
          "Конечная дата должна быть позже начальной.",
        "meeting.dateRangeTooLarge": () =>
          "Диапазон дат не должен превышать 90 дней.",
        "meeting.invalidDuration": () =>
          "Выберите длительность встречи больше нуля.",
        "meeting.durationTooLong": () =>
          "Длительность встречи не должна превышать 480 минут (8 часов).",
        "meeting.invalidParticipants": () =>
          "Минимум участников должен быть от 1 до размера группы.",
        "meeting.createFailed": () => "Пока не удалось создать запрос на встречу.",
        "meeting.busyBlocksLoadFailed": () =>
          "Пока не удалось загрузить занятые интервалы группы.",
        "meeting.noSlots": () =>
          "Подходящих слотов не найдено. Попробуйте расширить диапазон или снизить минимум участников.",
        "meeting.optionsSaveFailed": () =>
          "Слоты найдены, но пока не удалось их сохранить.",
        "meeting.loadFailed": () => "Сейчас не удалось загрузить этот запрос на встречу.",
        "meeting.optionsLoadFailed": () =>
          "Пока не удалось загрузить варианты встречи.",
        "meeting.votesLoadFailed": () => "Пока не удалось загрузить голоса.",
        "meeting.notFound": () => "Не удалось найти этот запрос на встречу.",
        "meeting.optionMissing": () => "Этот вариант встречи больше не существует.",
        "meeting.voteSaveFailed": () => "Пока не удалось сохранить ваш голос.",
        "meeting.selectOwnerOnly": () =>
          "Только владелец группы может выбрать финальный слот.",
        "meeting.selectFailed": () =>
          "Пока не удалось зафиксировать это время встречи.",
        "telegram.userMissing": () =>
          "Telegram не прислал профиль пользователя для этой сессии Mini App.",
        "telegram.miniAppCredentialsMissing": () =>
          "Telegram открыл wheno без данных Mini App. Запускайте его через кнопку меню бота или Web App кнопку.",
        "telegram.openFromMiniAppButton": () =>
          "Откройте wheno из кнопки Mini App у бота, а не как обычную ссылку.",
        "session.openFailed": () => "Пока не удалось открыть вашу сессию wheno.",
        "generic.unexpected": () => "Что-то пошло не так. Попробуйте ещё раз.",
      },
    };
  }

  return {
    language,
    nouns,
    shell: {
      productLabel: "telegram mini app",
      productDescription: "Shared scheduling inside Telegram.",
      signedInAs: "signed in as",
      themeLabel: "theme",
      languageLabel: "language",
      themeLight: "light",
      themeDark: "dark",
      languageEnglish: "EN",
      languageRussian: "RU",
    },
    common: {
      backHome: "Back home",
      backToGroup: "Back to group",
      cancel: "Cancel",
      create: "Create",
      join: "Join",
      tryAgain: "Try again",
      shareLink: "Share link",
      linkCopied: "Link copied",
      copyInviteLink: "Copy invite link",
      copyUnavailable: "Could not copy",
      total: "total",
      score: "score",
      owner: "owner",
      member: "member",
      open: "open",
      selected: "selected",
      minuteShort: "min",
      yes: "yes",
      maybe: "maybe",
      no: "no",
      inviteCode: "Invite code",
      shareThisLink: "Share this link",
      openGroup: "Open group",
      openCalendar: "My calendar",
      selectedSlot: "This slot has been selected as the final choice.",
      selectThisSlot: "Select this slot",
      noOneFree: "No one is free.",
      everyoneFree: "Everyone is free.",
      voteSummary: (yes: number, maybe: number, no: number) =>
        `Votes: ${yes} yes · ${maybe} maybe · ${no} no`,
    },
    home: {
      splashTitle: "Find the best time together",
      splashDescription: "We'll connect your Telegram profile, then load your groups.",
      title: "Your groups",
      description:
        "Create a group, collect busy times, and choose a slot together.",
      createGroup: "Create group",
      joinGroup: "Join group",
      emptyTitle: "No groups yet",
      emptyDescription:
        "Start with one friend group, then invite everyone with a short code.",
      emptyAction: "Create your first group",
    },
    createGroup: {
      title: "Create a group",
      splashDescription: "We need your Telegram session before we can create a group.",
      description: "Pick a short name your friends will recognize.",
      nameLabel: "Group name",
      namePlaceholder: "Friday dinner crew",
      submit: "Create",
      pending: "Creating group...",
    },
    join: {
      title: "Join a group",
      splashDescription: "We'll connect your Telegram session, then you can join with a code.",
      description: "Paste the invite code your friend shared with you.",
      codeLabel: "Invite code",
      codePlaceholder: "AB12CD",
      submit: "Join",
      pending: "Joining group...",
    },
    availability: {
      title: "Add busy time",
      splashDescription: "We need your Telegram session before we can save availability.",
      description: "Add a block you already know you can't make.",
      modeQuick: "Quick",
      modeManual: "Manual",
      modeWeekly: "Weekly",
      quickDateLabel: "Date",
      quickPresetLabel: "Quick add",
      manualTitle: "One-time busy block",
      weeklyTitle: "Recurring weekly block",
      titleLabel: "Title",
      titlePlaceholder: "Work call",
      dateLabel: "Date",
      startDateLabel: "Start date",
      endDateLabel: "End date",
      startLabel: "Start time",
      endLabel: "End time",
      weekdaysLabel: "Weekdays",
      submit: "Save busy block",
      pending: "Saving...",
      quickPresets: {
        lunch: "Lunch",
        workday: "Workday",
        evening: "Evening",
      },
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    calendar: {
      title: "My calendar",
      splashDescription: "We need your Telegram session before we can show your calendar.",
      description: "Your busy blocks for the week ahead.",
      addBusyTime: "Add busy time",
      upcomingTitle: "Upcoming blocks",
      weekTitle: "Week view",
      emptyTitle: "No busy blocks yet",
      emptyDescription:
        "Add one-time or weekly busy blocks, and they will appear here.",
      hoursLabel: "hours",
      freeDay: "Free",
    },
    group: {
      loadingTitle: "Loading group",
      splashDescription: "We'll connect your Telegram session, then load this group.",
      description:
        "Invite friends, add busy blocks, and start a meeting request when everyone is in.",
      addBusyTime: "Add busy time",
      findTime: "Find time",
      membersTitle: "Members",
      availabilityTitle: "Availability calendar",
      availabilityDescription: "Member busy blocks for the week ahead.",
      availabilityEmptyDay: "Free",
      availabilityNoBlocks: "No busy blocks this week yet.",
      availabilityBlocks: "blocks",
      myAvailabilityTitle: "My availability this week",
      myAvailabilityHint: "Tap a cell to mark or unmark it as busy.",
      gridMorning: "Morning",
      gridAfternoon: "Afternoon",
      gridEvening: "Evening",
      meetingRequestsTitle: "Meeting requests",
      noMeetingsTitle: "No meeting requests yet",
      noMeetingsOwnerDescription:
        "Once everyone has added a few busy times, ask wheno to suggest the best slots.",
      noMeetingsMemberDescription:
        "The group owner can create a meeting request once everyone has shared availability.",
      createMeetingRequest: "Create a meeting request",
    },
    findTime: {
      title: "Find time",
      splashDescription: "We'll connect your Telegram session, then load the scheduler.",
      description: "Set a date range and let wheno suggest the strongest common slots.",
      ownerOnly: "Only the group owner can create a meeting request for this group.",
      membersAvailable: (count: number) => `${nouns.members(count)} available to consider.`,
      membersLimit: (count: number) =>
        `Minimum participants cannot be higher than ${count}.`,
      titleLabel: "Meeting title",
      titlePlaceholder: "Dinner next week",
      fromLabel: "From",
      toLabel: "To",
      durationLabel: "Duration (minutes)",
      minParticipantsLabel: "Minimum participants",
      preferredTimeLabel: "Preferred time of day",
      anyTime: "Any time",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      submit: "Find the best slots",
      pending: "Calculating...",
    },
    meeting: {
      loadingTitle: "Loading meeting request",
      splashDescription: "We'll connect your Telegram session, then load the meeting options.",
      description:
          "Vote on the best slots, then lock the final one if you own the group.",
      noOptionsTitle: "No meeting options yet",
      noOptionsDescription: "There are no candidate slots on this meeting request yet.",
      summary: (range: string, duration: number, participants: number) =>
        `${range} · ${duration} min · at least ${nouns.participants(participants)}`,
      freeOf: (free: number, total: number) => `${free} of ${total} free`,
      notifyMessage: (groupName: string, title: string, date: string, time: string) =>
        `✅ <b>${groupName}</b>\nMeeting "${title}" scheduled!\n📅 ${date}\n🕐 ${time}`,
    },
    session: {
      checkingProfile: "Checking your Telegram profile.",
      opening: "Opening wheno",
      errorTitle: "We couldn't open wheno yet",
    },
    loading: {
      title: "Opening wheno",
      description: "Getting your groups and meeting requests ready.",
    },
    notFound: {
      title: "Nothing to see here",
      description: "The page you were looking for is not here anymore.",
      emptyTitle: "We couldn't find that page",
      emptyDescription:
        "The group or meeting may have moved, or you may need to join it first.",
    },
    errorPage: {
      title: "We hit a snag",
      description: "Something unexpected happened while loading this screen.",
      fallback: "Please try again in a moment.",
    },
    errors: {
      "auth.openFromTelegramAgain": () => "Please open wheno from Telegram again.",
      "user.loadProfileFailed": () => "We could not load your profile right now.",
      "session.saveTelegramProfileFailed": () =>
        "We could not save your Telegram profile yet.",
      "groups.loadFailed": () => "We could not load your groups right now.",
      "group.loadFailed": () => "We could not load this group right now.",
      "group.membersLoadFailed": () => "We could not load the group members yet.",
      "meeting.requestsLoadFailed": () => "We could not load the meeting requests yet.",
      "group.nameRequired": () => "Please give your group a name.",
      "group.nameTooLong": () => "Group name must be 80 characters or fewer.",
      "group.createFailed": () => "We could not create your group yet.",
      "group.ownerMembershipFailed": () =>
        "The group was created, but we could not add you as the owner.",
      "group.inviteCodeFailed": () =>
        "We could not generate an invite code right now. Please try again.",
      "group.inviteCodeRequired": () => "Please enter an invite code.",
      "group.inviteCodeCheckFailed": () => "We could not check that invite code yet.",
      "group.inviteCodeInvalid": () => "That invite code doesn't match any group.",
      "group.joinFailed": () => "We could not join that group yet.",
      "busyBlock.titleRequired": () => "Please name this busy block.",
      "busyBlock.titleTooLong": () => "Busy block title must be 80 characters or fewer.",
      "busyBlock.invalidDateRange": () => "End date needs to be after the start date.",
      "busyBlock.dateRangeTooLarge": () => "Date range must be 365 days or fewer.",
      "busyBlock.invalidTimeRange": () => "End time needs to be after the start time.",
      "busyBlock.weekdayRequired": () => "Choose at least one weekday.",
      "busyBlock.noMatchingWeekdays": () =>
        "No selected weekdays fall inside that date range.",
      "busyBlock.loadFailed": () => "We could not load your busy blocks yet.",
      "busyBlock.saveFailed": () => "We could not save that busy block yet.",
      "busyBlock.toggleFailed": () => "Could not update availability. Please try again.",
      "meeting.groupNotFound": () => "We could not find that group.",
      "meeting.ownerOnly": () => "Only the group owner can create a meeting request.",
      "meeting.titleRequired": () => "Please give the meeting request a title.",
      "meeting.titleTooLong": () => "Meeting title must be 80 characters or fewer.",
      "meeting.invalidDateRange": () => "The end date needs to come after the start date.",
      "meeting.dateRangeTooLarge": () => "Date range must be 90 days or fewer.",
      "meeting.invalidDuration": () => "Pick a meeting length longer than zero minutes.",
      "meeting.durationTooLong": () => "Meeting duration must be 480 minutes (8 hours) or less.",
      "meeting.invalidParticipants": () =>
        "Minimum participants must be between 1 and your member count.",
      "meeting.createFailed": () => "We could not create the meeting request yet.",
      "meeting.busyBlocksLoadFailed": () =>
        "We could not load the group's busy blocks yet.",
      "meeting.noSlots": () =>
        "No available slots found for that request. Try a wider range or fewer people.",
      "meeting.optionsSaveFailed": () =>
        "We found slots, but could not save them yet.",
      "meeting.loadFailed": () => "We could not load that meeting request right now.",
      "meeting.optionsLoadFailed": () => "We could not load the meeting options yet.",
      "meeting.votesLoadFailed": () => "We could not load the votes yet.",
      "meeting.notFound": () => "We could not find that meeting request.",
      "meeting.optionMissing": () => "That meeting option doesn't exist anymore.",
      "meeting.voteSaveFailed": () => "We could not save your vote yet.",
      "meeting.selectOwnerOnly": () =>
        "Only the group owner can select the final slot.",
      "meeting.selectFailed": () => "We could not lock in that meeting time yet.",
      "telegram.userMissing": () =>
        "Telegram did not send a user profile for this Mini App session.",
      "telegram.miniAppCredentialsMissing": () =>
        "Telegram opened wheno without Mini App credentials. Launch it from the bot's Menu Button or Web App button.",
      "telegram.openFromMiniAppButton": () =>
        "Open wheno from your bot's Mini App button in Telegram, not as a regular link.",
      "session.openFailed": () => "We could not open your wheno session yet.",
      "generic.unexpected": () => "Something went wrong. Please try again.",
    },
  };
}

export function getLocalizedErrorMessage(
  error: unknown,
  language: Language,
  fallbackKey: AppErrorKey = "generic.unexpected",
) {
  const translations = getTranslations(language);

  if (isAppError(error)) {
    return translations.errors[error.key]();
  }

  return translations.errors[fallbackKey]();
}
