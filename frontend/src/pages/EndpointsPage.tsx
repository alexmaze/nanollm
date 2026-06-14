import { useState } from "react";
import { Card, Flex, Box, Heading, Text, Button, Badge, Code, Table } from "@radix-ui/themes";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";

export default function EndpointsPage() {
  const { t } = useT();
  const { snapshot } = useConfigContext();
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  if (!snapshot) return null;

  const port = snapshot.port || window.location.port || "8080";
  const base = window.location.protocol + "//" + window.location.hostname + ":" + port;

  const copyUrl = (path: string) => {
    navigator.clipboard.writeText(base + path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    });
  };

  return (
    <Flex direction="column" gap="4">
      <Card>
        <Heading>{t("endpoints.heading")}</Heading>
        <Text color="gray" mb="4" as="p">
          {t("endpoints.meta")}
        </Text>
        <Table.Root>
          <Table.Body>
            {(snapshot.endpoints || []).map((ep) => (
              <Table.Row key={ep.path}>
                <Table.Cell width="80px">
                  <Badge color={ep.method === "POST" ? "green" : "blue"}>{ep.method}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Flex direction="column" gap="1">
                    <Code>{ep.path}</Code>
                    <Text size="1" color="gray">
                      {ep.protocol} · {ep.description}
                    </Text>
                  </Flex>
                </Table.Cell>
                <Table.Cell width="120px">
                  <Button
                    variant={copiedPath === ep.path ? "solid" : "soft"}
                    color={copiedPath === ep.path ? "green" : undefined}
                    size="1"
                    onClick={() => copyUrl(ep.path)}
                  >
                    {copiedPath === ep.path ? t("common.copied") : t("common.copy")}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Flex>
  );
}
