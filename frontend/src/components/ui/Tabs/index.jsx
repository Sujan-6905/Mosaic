import AnimatedTabs from "@/components/vendor/sona/animated-tabs";

// Sona's tabs (a Base UI tab list, so arrow keys move between tabs) in
// Mosaic's underline style, with the active underline gliding across.
const Tabs = ({ tabs, value, onChange, ariaLabel = "Tabs" }) => (
    <AnimatedTabs
        tabs={tabs.map((tab) => ({
            value: tab.value,
            title: (
                <span className="flex items-center gap-2">
                    {tab.icon}
                    {tab.label}
                </span>
            ),
        }))}
        value={value}
        onValueChange={onChange}
        ariaLabel={ariaLabel}
        className="bui w-full border-border p-0"
        listClassName="gap-1"
        tabClassName="rounded-none px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        activeTabClassName="text-[var(--color-accent)] hover:text-[var(--color-accent)]"
        indicatorClassName="inset-x-0 top-auto bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]"
    />
);

export default Tabs;
