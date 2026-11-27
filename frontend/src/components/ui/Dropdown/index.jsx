import {
    AnimatedDropdown,
    AnimatedDropdownContent,
    AnimatedDropdownItem,
    AnimatedDropdownSeparator,
    AnimatedDropdownTrigger,
} from "@/components/vendor/sona/animated-dropdown";

// `closeOnSelect={false}` keeps toggle-style menus open between picks.
const Dropdown = ({ trigger, items, header, align = "end", className, closeOnSelect = true }) => {
    const menu = (
        <AnimatedDropdown modal={false}>
            <AnimatedDropdownTrigger render={trigger} />
            <AnimatedDropdownContent align={align} className="max-h-[min(24rem,70vh)] overflow-y-auto">
                {header && (
                    <>
                        <div className="px-1.5 py-1">{header}</div>
                        <AnimatedDropdownSeparator />
                    </>
                )}
                {items.map((item, i) =>
                    item.divider ? (
                        <AnimatedDropdownSeparator key={`divider-${i}`} />
                    ) : (
                        <AnimatedDropdownItem
                            key={item.key ?? item.label}
                            icon={item.icon}
                            variant={item.destructive ? "danger" : item.dangerOnHover ? "danger-on-hover" : "default"}
                            disabled={item.disabled}
                            closeOnClick={closeOnSelect}
                            onClick={item.onSelect}
                        >
                            {item.label}
                        </AnimatedDropdownItem>
                    ),
                )}
            </AnimatedDropdownContent>
        </AnimatedDropdown>
    );

    return className ? <div className={className}>{menu}</div> : menu;
};

export default Dropdown;
