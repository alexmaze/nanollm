import { Flex, Button, Callout } from "@radix-ui/themes";
import { ExclamationTriangleIcon, LayersIcon, ReloadIcon, PlusIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import { useStatusData } from "../hooks/useStatus";
import type { HydratedForm } from "../hooks/useConfig";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ModelCard from "../components/ModelCard";
import GuardedResetButton from "../components/GuardedResetButton";
import PageSkeleton from "../components/PageSkeleton";

let localIdCounter = 0;
function nextId(p: string) {
  localIdCounter++;
  return p + "-" + localIdCounter;
}

export default function ModelsPage() {
  const { t } = useT();
  const { snapshot, form, updateForm, refreshConfig } = useConfigContext();
  const { data: statusData } = useStatusData();

  if (!form || !snapshot) {
    return <PageSkeleton cards={Math.max(2, Math.min(5, form?.models.length || 2))} />;
  }

  const addModel = () => {
    updateForm((prev) => {
      const newModels = [...prev.models];
      const id = nextId("m");
      newModels.push({
        _id: id,
        _expanded: false,
        name: "",
        provider: "openai-chat",
        base_url: "",
        api_key: "",
        model: "",
        extras: {},
      });
      return { ...prev, models: newModels as HydratedForm["models"] };
    });
  };

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("models.heading")} description={t("models.meta")}>
        <Button variant="ghost" onClick={refreshConfig}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
        <GuardedResetButton />
        <Button onClick={addModel}>
          <PlusIcon />
          {t("common.addModel")}
        </Button>
      </PageHeader>

      {snapshot.lastError && (
        <Callout.Root color="red">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>
            {snapshot.lastError.message} ({snapshot.lastError.source})
          </Callout.Text>
        </Callout.Root>
      )}

      {form.models.length === 0 ? (
        <EmptyState
          title={t("models.empty")}
          description={t("models.meta")}
          icon={<LayersIcon />}
          action={<Button onClick={addModel}>{t("common.addModel")}</Button>}
        />
      ) : (
        <Flex direction="column" gap="3">
          {form.models.map((_, i) => (
            <ModelCard key={_.name ? `model-${_.name}-${i}` : `model-${i}`} index={i} statusData={statusData} />
          ))}
        </Flex>
      )}
    </Flex>
  );
}
