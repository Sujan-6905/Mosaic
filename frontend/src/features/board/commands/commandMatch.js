// Every word of the query must appear in the command's text, in any order.

const searchableText = (command) => `${command.label} ${command.category}`.toLowerCase();

export const matchesCommand = (command, query) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return true;
    const haystack = searchableText(command);
    return trimmed.split(/\s+/).every((word) => haystack.includes(word));
};

// A label that starts with the query ranks above one that only contains it, then category matches.
const rankOf = (command, query) => {
    const label = command.label.toLowerCase();
    const trimmed = query.trim().toLowerCase();
    if (label.startsWith(trimmed)) return 0;
    if (label.includes(trimmed)) return 1;
    return 2;
};

export const filterCommands = (commands, query) => {
    const matched = commands.filter((command) => matchesCommand(command, query));
    if (!query.trim()) return matched;
    return [...matched].sort((a, b) => rankOf(a, query) - rankOf(b, query));
};
