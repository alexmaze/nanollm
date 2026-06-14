import { Flex, Button } from "@radix-ui/themes";
import { StackIcon, ReloadIcon, PlusIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import FallbackCard from "../components/FallbackCard";
import GuardedResetButton from "../components/GuardedResetButton";
import PageSkeleton from "../components/PageSkeleton";

let fgIdCounter = 0;
function nextFgId() {
  fgIdCounter++;
  return "fg-" + fgIdCounter;
}

export default function FallbackPage() {
  const { t } = useT();
  const { form, updateForm, refreshConfig } = useConfigContext();

  if (!form) return <PageSkeleton cards={3} />;

  const addGroup = () => {
    updateForm((prev) => ({
      ...prev,
      fallbackGroups: [...prev.fallbackGroups, { _id: nextFgId(), name: "", members: [] }],
    }));
  };

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("fallback.heading")} description={t("fallback.meta")}>
        <Button variant="ghost" onClick={refreshConfig}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
        <GuardedResetButton />
        <Button onClick={addGroup}>
          <PlusIcon />
          {t("common.addGroup")}
        </Button>
      </PageHeader>

      {form.fallbackGroups.length === 0 ? (
        <EmptyState
          title={t("fallback.empty")}
          description={t("fallback.meta")}
          icon={<StackIcon />}
          action={<Button onClick={addGroup}>{t("common.addGroup")}</Button>}
        />
      ) : (
        <Flex direction="column" gap="3">
          {form.fallbackGroups.map((_, i) => (
            <FallbackCard key={i} groupIndex={i} />
          ))}
        </Flex>
      )}
    </Flex>
  );
}
