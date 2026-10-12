export type ThemeSlot = 'light' | 'dark';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}
