import { useState } from "react";
import { useT } from "../i18n";

const STRING_PREVIEW_LENGTH = 100;

interface Props {
  value: unknown;
  depth?: number;
  expandedDepth?: number;
}

function createChildOpts(props: Props): Props {
  return { ...props, depth: (props.depth ?? 0) + 1 };
}

export default function JsonTree({ value, depth = 0, expandedDepth = 1 }: Props) {
  const [expanded, setExpanded] = useState(depth < expandedDepth);
  const childOpts = createChildOpts({ value, depth, expandedDepth });

  if (value === null) {
    return <span style={{ color: "var(--purple-9)" }}>null</span>;
  }

  if (Array.isArray(value)) {
    return (
      <details open={expanded} style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        <summary
          style={{ color: "var(--accent-9)", cursor: "pointer" }}
          onClick={(e) => {
            e.preventDefault();
            setExpanded((p) => !p);
          }}
        >
          Array({value.length})
        </summary>
        <div style={{ margin: "4px 0" }}>
          {value.map((item, i) => (
            <div key={i} style={{ margin: "4px 0", lineHeight: 1.5, wordBreak: "break-word" }}>
              <span style={{ color: "var(--amber-9)" }}>{i}: </span>
              <JsonTree value={item} depth={depth + 1} expandedDepth={expandedDepth} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <details open={expanded} style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        <summary
          style={{ color: "var(--accent-9)", cursor: "pointer" }}
          onClick={(e) => {
            e.preventDefault();
            setExpanded((p) => !p);
          }}
        >
          {"{"}{entries.length}{"}"}
        </summary>
        <div style={{ margin: "4px 0" }}>
          {entries.map(([k, v]) => (
            <div key={k} style={{ margin: "4px 0", lineHeight: 1.5, wordBreak: "break-word" }}>
              <span style={{ color: "var(--amber-9)" }}>{k}: </span>
              <JsonTree value={v} depth={depth + 1} expandedDepth={expandedDepth} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  if (typeof value === "string") {
    const quoted = JSON.stringify(value);
    if (value.length <= STRING_PREVIEW_LENGTH) {
      return <span style={{ color: "var(--green-9)", whiteSpace: "pre-wrap" }}>{quoted}</span>;
    }
    return <LongString value={value} quoted={quoted} />;
  }

  if (typeof value === "number") {
    return <span style={{ color: "var(--blue-9)" }}>{String(value)}</span>;
  }

  if (typeof value === "boolean") {
    return <span style={{ color: "var(--purple-9)" }}>{String(value)}</span>;
  }

  return <span>{String(value)}</span>;
}

function LongString({ value, quoted }: { value: string; quoted: string }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <details style={{ display: "inline-block", verticalAlign: "top", maxWidth: "100%" }}>
      <summary
        style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, listStyle: "none" }}
        onClick={(e) => {
          e.preventDefault();
          setShow((p) => !p);
        }}
      >
        <span style={{ color: "var(--green-9)" }}>
          {JSON.stringify(value.slice(0, STRING_PREVIEW_LENGTH) + "\u2026")}
        </span>
        <span style={{ color: "var(--gray-9)", fontSize: 12 }}>{t("common.chars", { count: value.length })}</span>
        <span style={{ color: "var(--accent-9)", fontSize: 12 }}>{show ? t("common.collapse") : t("common.expand")}</span>
      </summary>
      {show && (
        <div style={{ margin: "4px 0" }}>
          <span style={{ color: "var(--green-9)", whiteSpace: "pre-wrap" }}>{quoted}</span>
        </div>
      )}
    </details>
  );
}
