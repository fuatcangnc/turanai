import { createNavigationMenu } from "@data-slot/navigation-menu";

const initialized = new WeakSet<HTMLElement>();

export const initNavigationMenu = () => {
  document
    .querySelectorAll<HTMLElement>('[data-slot="navigation-menu"]')
    .forEach((el) => {
      if (initialized.has(el)) return;
      initialized.add(el);
      createNavigationMenu(el);
    });
};
