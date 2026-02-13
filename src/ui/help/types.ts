export type HelpItem = {
  id: string;
  title: string;
  lines: string[];
  note?: string;
  code?: string;
};

export type HelpGroup = {
  id: string;
  title: string;
  items: HelpItem[];
};
