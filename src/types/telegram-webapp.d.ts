export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        colorScheme?: "light" | "dark";
        initDataUnsafe?: {
          user?: {
            language_code?: string;
          };
        };
        expand?: () => void;
        disableVerticalSwipes?: () => void;
        isVerticalSwipesEnabled?: boolean;
      };
    };
  }
}
