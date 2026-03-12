import { PageChrome, type PageChromeProps } from "./page-chrome";

/** @deprecated Use PageChrome — kept for backward-compatible imports */
export type PageHeaderProps = PageChromeProps;

export function PageHeader(props: PageHeaderProps) {
  return <PageChrome {...props} />;
}
