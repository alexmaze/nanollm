import { useState } from "react";
import { Card, Flex, Heading, Text, Button, Badge, Code, Table, Tooltip } from "@radix-ui/themes";
import { Link2Icon, CopyIcon, CheckIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import PageHeader from "../components/PageHeader";
import PageSkeleton from "../components/PageSkeleton";

export default function EndpointsPage() {
  const { t } = useT();
  const { snapshot, refreshConfig } = useConfigContext();
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  if (!snapshot) return <PageSkeleton cards={3} />;

  const port = snapshot.port || window.location.port || "8080";
  const base = window.location.protocol + "//" + window.location.hostname + ":" + port;

  const copyUrl = (path: string) => {
    navigator.clipboard.writeText(base + path).then(() => {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    }).catch(() => {
      /* clipboard unavailable (insecure context) — silently ignore */
    });
  };

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("endpoints.heading")} description={t("endpoints.meta")}>
        <Button variant="ghost" onClick={refreshConfig}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
      </PageHeader>

      <Card>
        <Heading size="3" mb="4">
          {t("endpoints.heading")}
        </Heading>
        <Table.Root size="2" variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell width="80px">{t("endpoints.method")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("endpoints.path")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("endpoints.protocol")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>{t("endpoints.description")}</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="120px" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(snapshot.endpoints || []).map((ep) => (
              <Table.Row key={ep.path}>
                <Table.Cell>
                  <Badge color={ep.method === "POST" ? "green" : "blue"} variant="soft" size="1">
                    {ep.method}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <Code size="2" style={{ wordBreak: "break-all" }}>
                    {ep.path}
                  </Code>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2">{ep.protocol}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="2" color="gray">
                    {ep.description}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <Tooltip content={copiedPath === ep.path ? t("common.copied") : t("common.copy")}>
                    <Button
                      variant={copiedPath === ep.path ? "solid" : "soft"}
                      color={copiedPath === ep.path ? "green" : "gray"}
                      size="1"
                      aria-label={copiedPath === ep.path ? t("common.copied") : t("common.copy")}
                      onClick={() => copyUrl(ep.path)}
                    >
                      {copiedPath === ep.path ? <CheckIcon /> : <CopyIcon />}
                      {copiedPath === ep.path ? t("common.copied") : t("common.copy")}
                    </Button>
                  </Tooltip>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Flex>
  );
}
