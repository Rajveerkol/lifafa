import type { LifafaTheme, LifafaThemeId } from './types';
import { birthdayTheme } from './variants/birthday';
import { newYearTheme } from './variants/newYear';
import { rewardsTheme } from './variants/rewards';
import { diwaliTheme } from './variants/diwali';
import { holiTheme } from './variants/holi';
import { ganeshTheme } from './variants/ganeshChaturthi';
import { durgaTheme } from './variants/durgaNavami';

export const THEME_REGISTRY: Record<LifafaThemeId, LifafaTheme> = {
  rewards: rewardsTheme,
  birthday: birthdayTheme,
  new_year: newYearTheme,
  diwali: diwaliTheme,
  holi: holiTheme,
  ganesh_chaturthi: ganeshTheme,
  durga_navami: durgaTheme,
};

export const ALL_THEMES: LifafaTheme[] = [
  rewardsTheme,
  birthdayTheme,
  newYearTheme,
  diwaliTheme,
  holiTheme,
  ganeshTheme,
  durgaTheme,
];

export const DEFAULT_THEME_ID: LifafaThemeId = 'rewards';

export function getTheme(id?: string | null): LifafaTheme {
  if (id && id in THEME_REGISTRY) {
    return THEME_REGISTRY[id as LifafaThemeId];
  }
  return THEME_REGISTRY[DEFAULT_THEME_ID];
}

export function isValidThemeId(id?: string | null): id is LifafaThemeId {
  return typeof id === 'string' && id in THEME_REGISTRY;
}
