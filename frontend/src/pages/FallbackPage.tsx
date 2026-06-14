import { Card, Flex, Box, Button, Heading, Text, Badge } from "@radix-ui/themes";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import FallbackCard from "../components/FallbackCard";

let fgIdCounter = 0;
function nextFgId() {
  fgIdCounter++;
  return "fg-" + fgIdCounter;
}

export default function FallbackPage() {
  const { t } = useT();
  const { form, updateForm } = useConfigContext();

  if (!form) return null;

  const addGroup = () => {
    updateForm((prev) => ({
      ...prev,
      fallbackGroups: [...prev.fallbackGroups, { _id: nextFgId(), name: "", members: [] }],
    }));
  };

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Flex justify="between" align="start" wrap="wrap" gap="3">
          <Box>
            <Heading>{t("fallback.heading")}</Heading>
            <Text color="gray">{t("fallback.meta")}</Text>
          </Box>
          <Button onClick={addGroup}>{t("common.addGroup")}</Button>
        </Flex>
        <Flex gap="2" mt="3">
          <Badge color="green">{t("fallback.count", { count: form.fallbackGroups.length })}</Badge>
        </Flex>
      </Card>

      {form.fallbackGroups.length === 0 ? (
        <Card>
          <Text color="gray">{t("fallback.empty")}</Text>
        </Card>
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
