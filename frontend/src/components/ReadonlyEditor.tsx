import { useMemo } from "react";
import { Editor } from "@monaco-editor/react";
import { Box } from "@radix-ui/themes";
import { useAppearance } from "../theme/ThemeProvider";

interface ReadonlyEditorProps {
  value: string;
  language?: "json" | "javascript" | "plaintext";
  maxHeight?: number;
  minHeight?: number;
}

const LINE_HEIGHT = 19;
const VERTICAL_PADDING = 24;

/**
 * Read-only Monaco viewer for inspecting JSON / text payloads in record
 * details. Height auto-fits the content up to `maxHeight`, after which the
 * editor scrolls internally. Follows the active theme.
 */
export default function ReadonlyEditor({
  value,
  language = "json",
  maxHeight = 480,
  minHeight = 80,
}: ReadonlyEditorProps) {
  const { appearance } = useAppearance();

  const height = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.min(Math.max(lines * LINE_HEIGHT + VERTICAL_PADDING, minHeight), maxHeight);
  }, [value, maxHeight, minHeight]);

  const options = useMemo(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on" as const,
      wordWrap: "on" as const,
      folding: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      automaticLayout: true,
      fontSize: 13,
      lineHeight: LINE_HEIGHT,
      renderLineHighlight: "none" as const,
      padding: { top: 8, bottom: 8 },
      overviewRulerLanes: 0,
      scrollbar: { vertical: "auto" as const, horizontal: "auto" as const, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      fixedOverflowWidgets: true,
    }),
    [],
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
      />
    </Box>
  );
}
