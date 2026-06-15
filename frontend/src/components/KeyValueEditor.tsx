import { useState, useCallback } from "react";
import { Box, Flex, TextField, IconButton, Text } from "@radix-ui/themes";
import { PlusIcon, Cross2Icon } from "@radix-ui/react-icons";
import { useT } from "../i18n";

interface KeyValueEditorProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

interface Row {
  _id: number;
  key: string;
  value: string;
}

let kvIdCounter = 0;
function nextKvId() {
  return ++kvIdCounter;
}

function toRows(value: Record<string, string>): Row[] {
  const entries = Object.entries(value);
  if (entries.length === 0) return [{ _id: nextKvId(), key: "", value: "" }];
  return entries.map(([key, value]) => ({ _id: nextKvId(), key, value }));
}

function toObject(rows: Row[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    result[key] = row.value;
  }
  return result;
}

/**
 * Dynamic key/value pair editor for string maps (e.g. model `headers`).
 * Renders an always-present empty trailing row so users can append entries.
 * Duplicate keys: last one wins when serialized to an object.
 */
export default function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: KeyValueEditorProps) {
  const { t } = useT();
  const [rows, setRows] = useState<Row[]>(() => toRows(value));

  // Sync external value changes (e.g. reset) into local rows.
  const [prevValueRef, setPrevValueRef] = useState(value);
  if (prevValueRef !== value) {
    setPrevValueRef(value);
    setRows(toRows(value));
  }

  const emit = useCallback((next: Row[]) => {
    setRows(next);
    onChange(toObject(next));
  }, [onChange]);

  const updateRow = (index: number, patch: Partial<Row>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    emit(next);
  };

  const addRow = () => {
    emit([...rows, { _id: nextKvId(), key: "", value: "" }]);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    emit(next.length === 0 ? [{ _id: nextKvId(), key: "", value: "" }] : next);
  };

  return (
    <Flex direction="column" gap="2">
      {rows.map((row, index) => (
        <Flex key={row._id} gap="2" align="center">
          <Box style={{ flex: 1 }}>
            <TextField.Root
              value={row.key}
              placeholder={keyPlaceholder ?? t("editor.keyPlaceholder")}
              onChange={(e) => updateRow(index, { key: e.target.value })}
            />
          </Box>
          <Text color="gray" size="2" style={{ flexShrink: 0 }}>
            :
          </Text>
          <Box style={{ flex: 2 }}>
            <TextField.Root
              value={row.value}
              placeholder={valuePlaceholder ?? t("editor.valuePlaceholder")}
              onChange={(e) => updateRow(index, { value: e.target.value })}
            />
          </Box>
          <IconButton
            variant="ghost"
            color="gray"
            size="2"
            aria-label={t("editor.removeRow")}
            onClick={() => removeRow(index)}
          >
            <Cross2Icon />
          </IconButton>
        </Flex>
      ))}
      <Flex>
        <IconButton variant="soft" color="gray" size="2" onClick={addRow} aria-label={t("editor.addRow")}>
          <PlusIcon />
        </IconButton>
      </Flex>
    </Flex>
  );
}
