import { useRef, useCallback } from "react";
import { Card, Flex, Box, Button, Text, TextField, Select, IconButton, Badge, Tooltip } from "@radix-ui/themes";
import { DragHandleDots2Icon, ArrowUpIcon, ArrowDownIcon, TrashIcon, PlusIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import type { HydratedForm } from "../hooks/useConfig";
import ConfirmDialog from "./ConfirmDialog";

let memberIdCounter = 0;
function nextMemberId() {
  memberIdCounter++;
  return "fm-" + memberIdCounter;
}

function getModelNameOptions(form: HydratedForm): string[] {
  return form.models.map((m) => (m.name || "").trim()).filter(Boolean);
}

function getDuplicateMembers(members: { value: string }[]): string[] {
  const count = new Map<string, number>();
  for (const m of members) {
    const v = (m.value || "").trim();
    if (!v) continue;
    count.set(v, (count.get(v) || 0) + 1);
  }
  return [...count.entries()].filter(([, n]) => n > 1).map(([v]) => v);
}

interface FallbackCardProps {
  groupIndex: number;
}

export default function FallbackCard({ groupIndex }: FallbackCardProps) {
  const { t } = useT();
  const { form, updateForm } = useConfigContext();
  const nameInputRef = useRef<HTMLInputElement>(null);

  if (!form) return null;
  const group = form.fallbackGroups[groupIndex];
  if (!group) return null;

  const options = getModelNameOptions(form);
  const duplicates = getDuplicateMembers(group.members);

  const setName = useCallback(
    (name: string) => {
      updateForm((prev) => {
        const groups = [...prev.fallbackGroups];
        groups[groupIndex] = { ...groups[groupIndex], name };
        return { ...prev, fallbackGroups: groups };
      });
    },
    [groupIndex, updateForm],
  );

  const deleteGroup = useCallback(() => {
    updateForm((prev) => ({
      ...prev,
      fallbackGroups: prev.fallbackGroups.filter((_, i) => i !== groupIndex),
    }));
  }, [groupIndex, updateForm]);

  const setMemberValue = useCallback(
    (memberIndex: number, value: string) => {
      updateForm((prev) => {
        const groups = [...prev.fallbackGroups];
        const members = [...groups[groupIndex].members];
        members[memberIndex] = { ...members[memberIndex], value };
        groups[groupIndex] = { ...groups[groupIndex], members };
        return { ...prev, fallbackGroups: groups };
      });
    },
    [groupIndex, updateForm],
  );

  const moveMember = useCallback(
    (from: number, to: number) => {
      updateForm((prev) => {
        const groups = [...prev.fallbackGroups];
        const members = [...groups[groupIndex].members];
        if (from < 0 || to < 0 || from >= members.length || to >= members.length || from === to) return prev;
        const [item] = members.splice(from, 1);
        members.splice(to, 0, item);
        groups[groupIndex] = { ...groups[groupIndex], members };
        return { ...prev, fallbackGroups: groups };
      });
    },
    [groupIndex, updateForm],
  );

  const deleteMember = useCallback(
    (memberIndex: number) => {
      updateForm((prev) => {
        const groups = [...prev.fallbackGroups];
        const members = groups[groupIndex].members.filter((_, i) => i !== memberIndex);
        groups[groupIndex] = { ...groups[groupIndex], members };
        return { ...prev, fallbackGroups: groups };
      });
    },
    [groupIndex, updateForm],
  );

  const addMember = useCallback(() => {
    updateForm((prev) => {
      const groups = [...prev.fallbackGroups];
      const members = [...groups[groupIndex].members];
      const used = new Set(members.map((m) => m.value).filter(Boolean));
      const available = options.filter((o) => !used.has(o));
      members.push({ _id: nextMemberId(), value: available[0] || "" });
      groups[groupIndex] = { ...groups[groupIndex], members };
      return { ...prev, fallbackGroups: groups };
    });
  }, [groupIndex, updateForm, options]);

  const getDragData = useCallback(
    (memberIndex: number) => {
      return { prevGroupIndex: groupIndex, prevMemberIndex: memberIndex };
    },
    [groupIndex],
  );

  return (
    <Card size="2" className="app-hover-card">
      <Flex justify="between" align="start" gap="3" wrap="wrap" mb="4">
        <Box style={{ flex: 1, minWidth: 240 }}>
          <Text as="label" size="2" weight="medium" color="gray">
            {t("fallback.labelName")}
          </Text>
          <TextField.Root
            ref={nameInputRef}
            mt="2"
            value={group.name}
            placeholder={t("fallback.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </Box>
        <Flex align="center" gap="2" mt="5">
          <Badge variant="soft" color="indigo">
            {group.members.length} {t("status.models")}
          </Badge>
          <ConfirmDialog
            title={t("fallback.confirmDeleteTitle")}
            description={t("fallback.confirmDeleteDescription", { name: group.name || t("fallback.unnamedGroup", { index: groupIndex + 1 }) })}
            confirmLabel={t("common.delete")}
            cancelLabel={t("common.no")}
            destructive
            onConfirm={deleteGroup}
            trigger={
              <IconButton color="red" variant="ghost" size="2" aria-label={t("common.delete")}>
                <TrashIcon />
              </IconButton>
            }
          />
        </Flex>
      </Flex>

      <Flex direction="column" gap="2">
        {duplicates.length > 0 && (
          <Text size="2" color="red" mb="1">
            {t("fallback.duplicateMembers", { names: duplicates.join(", ") })}
          </Text>
        )}

        {group.members.length === 0 && (
          <Box py="2">
            <Text size="2" color="gray">
              {t("fallback.noMembers")}
            </Text>
          </Box>
        )}

        {group.members.map((member, mi) => {
          const used = new Set(group.members.filter((m, i) => i !== mi).map((m) => m.value).filter(Boolean));
          return (
            <Flex
              key={member._id}
              align="center"
              gap="2"
              p="2"
              style={{
                border: "1px solid var(--gray-5)",
                borderRadius: "var(--radius-3)",
                backgroundColor: "var(--gray-1)",
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", JSON.stringify(getDragData(mi)));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = "var(--accent-2)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.background = "";
              }}
              onDrop={(e) => {
                e.currentTarget.style.background = "";
                try {
                  const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                  if (typeof data.prevMemberIndex === "number") {
                    moveMember(data.prevMemberIndex, mi);
                  }
                } catch {}
              }}
            >
              <Tooltip content={t("fallback.dragHandle")}>
                <IconButton variant="ghost" size="1" aria-label={t("fallback.dragHandle")} style={{ cursor: "grab" }}>
                  <DragHandleDots2Icon />
                </IconButton>
              </Tooltip>

              <Select.Root value={member.value || undefined} onValueChange={(v) => setMemberValue(mi, v)}>
                <Select.Trigger style={{ flex: 1 }} placeholder={t("fallback.selectModel")} />
                <Select.Content>
                  <Select.Group>
                    <Select.Label>{options.length === 0 ? t("fallback.noModelsAvailable") : t("fallback.selectModel")}</Select.Label>
                    {options
                      .filter((o) => !used.has(o) || o === member.value)
                      .map((o) => (
                        <Select.Item key={o} value={o}>
                          {o}
                        </Select.Item>
                      ))}
                  </Select.Group>
                </Select.Content>
              </Select.Root>

              <Flex gap="2">
                <IconButton variant="ghost" size="1" aria-label={t("fallback.moveUp")} onClick={() => moveMember(mi, mi - 1)} disabled={mi === 0}>
                  <ArrowUpIcon />
                </IconButton>
                <IconButton variant="ghost" size="1" aria-label={t("fallback.moveDown")} onClick={() => moveMember(mi, mi + 1)} disabled={mi === group.members.length - 1}>
                  <ArrowDownIcon />
                </IconButton>
                <IconButton color="red" variant="ghost" size="1" aria-label={t("common.delete")} onClick={() => deleteMember(mi)}>
                  <TrashIcon />
                </IconButton>
              </Flex>
            </Flex>
          );
        })}
      </Flex>

      <Button variant="soft" mt="3" size="2" onClick={addMember} disabled={options.length === 0}>
        <PlusIcon />
        {t("common.addMember")}
      </Button>
    </Card>
  );
}
