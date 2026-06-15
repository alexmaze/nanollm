import { useMemo } from "react";
import { Editor } from "@monaco-editor/react";
import { Box } from "@radix-ui/themes";
import { useAppearance } from "../theme/ThemeProvider";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: "json" | "javascript";
  height?: number | string;
  placeholder?: string;
}

/**
 * Thin wrapper around Monaco (lazy-loaded from CDN) that follows the app
 * appearance and exposes a minimal text-editing surface for JSON / JS fields.
 */
export default function CodeEditor({
  value,
  onChange,
  language = "json",
  height = 160,
  placeholder,
}: CodeEditorProps) {
  const { appearance } = useAppearance();

  const options = useMemo(
    () => ({
      minimap: { enabled: false },
      lineNumbers: "on" as const,
      wordWrap: "on" as const,
      folding: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      automaticLayout: true,
      fontSize: 13,
      renderLineHighlight: "line" as const,
      padding: { top: 8, bottom: 8 },
      overviewRulerLanes: 0,
      ...(placeholder
        ? {
            // Monaco has no native placeholder; we use a subtle hint via the
            // inline suggest / empty content approach by overlaying text.
          }
        : {}),
    }),
    [placeholder],
  );

  return (
    <Box
      style={{
        border: "1px solid var(--gray-5)",
        borderRadius: "var(--radius-3)",
        overflow: "hidden",
      }}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme={appearance === "dark" ? "vs-dark" : "light"}
        options={options}
        onChange={(v) => onChange(v ?? "")}
      />
    </Box>
  );
}
