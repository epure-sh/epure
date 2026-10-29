import * as React from "react";
import { List } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DesignKitNav } from "./design-kit-nav";

export function DesignKitCatalogShell({
  active,
  onSelect,
  onOpenSearch,
}: {
  active: string;
  onSelect: (id: string) => void;
  onOpenSearch?: () => void;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const close = () => setMobileOpen(false);

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[85] bg-overlay backdrop-blur-xs transition-opacity lg:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={close}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[86] flex w-[min(100%,18rem)] flex-col border-r border-border-subtle bg-surface-1 shadow-2xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-label="Design kit catalog"
        aria-hidden={!mobileOpen}
      >
        <DesignKitNav
          active={active}
          onSelect={onSelect}
          onClose={close}
          onOpenSearch={onOpenSearch}
          className="h-full border-0"
        />
      </aside>

      {/* Desktop: fixed-height catalog beside the infinite canvas */}
      <aside
        className="relative z-20 hidden h-full w-64 shrink-0 overflow-hidden border-r border-border-subtle bg-surface-1 lg:block xl:w-72"
        aria-label="Design kit catalog"
      >
        <DesignKitNav active={active} onSelect={onSelect} onOpenSearch={onOpenSearch} />
      </aside>

      {!mobileOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed bottom-4 left-4 z-[84] shadow-tactile lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
        >
          <List size={14} className="mr-1.5" />
          Catalog
        </Button>
      ) : null}
    </>
  );
}
