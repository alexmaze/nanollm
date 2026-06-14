import { Card, Flex, Box, Button, Heading, Text, Badge, Callout } from "@radix-ui/themes";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import { useStatusData } from "../hooks/useStatus";
import type { HydratedForm } from "../hooks/useConfig";
import ModelCard from "../components/ModelCard";

let localIdCounter = 0;
function nextId(p: string) {
  localIdCounter++;
  return p + "-" + localIdCounter;
}

export default function ModelsPage() {
  const { t } = useT();
  const { snapshot, form, updateForm } = useConfigContext();
  const { data: statusData } = useStatusData();

  if (!form || !snapshot) {
    return (
      <Card>
        <Text color="gray">{t("common.loading")}</Text>
      </Card>
    );
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
    <Flex direction="column" gap="4">
      {/* Header */}
      <Card>
        <Flex justify="between" align="start" wrap="wrap" gap="3">
          <Box>
            <Heading>{t("models.heading")}</Heading>
            <Text color="gray">{t("models.meta")}</Text>
          </Box>
          <Button onClick={addModel}>{t("common.addModel")}</Button>
        </Flex>
        <Flex gap="2" mt="3" wrap="wrap">
          <Badge color="green">{t("models.count", { count: form.models.length })}</Badge>
          {snapshot.lastError && (
            <Badge color="red">{t("models.loadError")}</Badge>
          )}
        </Flex>
        {snapshot.lastError && (
          <Callout.Root color="red" mt="2">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>
              {snapshot.lastError.message} ({snapshot.lastError.source})
            </Callout.Text>
          </Callout.Root>
        )}
      </Card>

      {/* Model cards */}
      {form.models.length === 0 ? (
        <Card>
          <Text color="gray">{t("models.empty")}</Text>
        </Card>
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
