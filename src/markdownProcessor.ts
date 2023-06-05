function convert_urls(line: string): string {
    if (line.includes("![](assets/")) {
        line = line.replace(/%20/g, "-");
    }
    return line.replace(/\[(.*?)\]\((\.\.\/)+(.*?)\.md\)/g, "[\$1](./\$3)");
}
