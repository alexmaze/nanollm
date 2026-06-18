import { useState, useEffect, useMemo, useCallback } from "react";
import { Flex, Box, Button, Callout, Card, Heading, Text, TextField, Select, IconButton, Tooltip, Badge, Spinner } from "@radix-ui/themes";
import {
  ExclamationTriangleIcon,
  LayersIcon,
  ReloadIcon,
  PlusIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import { useStatusData } from "../hooks/useStatus";
import type { HydratedForm } from "../hooks/useConfig";
import type { TestModelResult } from "../api";
import { api } from "../api";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import ModelListItem, { PROVIDERS, type BatchTestEntry } from "../components/ModelListItem";
import ModelDetail from "../components/ModelDetail";
import GuardedResetButton from "../components/GuardedResetButton";
import PageSkeleton from "../components/PageSkeleton";

// Local id generator for newly created models (kept separate from the
// hydrate-time counter in useConfig to avoid collisions on the same prefix).
let localIdCounter = 0;
function nextId() {
  localIdCounter++;
  return `m-new-${localIdCounter}`;
}

type MobileView = "list" | "detail";

interface BatchState {
  state: "idle" | "running" | "done";
  tested: number;
  total: number;
  ok: number;
  failed: number;
  results: Record<string, BatchTestEntry>;
}

const EMPTY_BATCH: BatchState = {
  state: "idle",
  tested: 0,
  total: 0,
  ok: 0,
  failed: 0,
  results: {},
};

export default function ModelsPage() {
  const { t } = useT();
  const { snapshot, form, updateForm, refreshConfig } = useConfigContext();
  const { data: statusData } = useStatusData();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [batch, setBatch] = useState<BatchState>(EMPTY_BATCH);

  // Auto-select the first model once the form first loads (if nothing is
  // selected yet) so the detail pane isn't empty on initial visit.
  useEffect(() => {
    if (form && form.models.length > 0 && selectedId === null) {
      setSelectedId(form.models[0]._id);
    }
  }, [form, selectedId]);

  // Keep the selected list item in view (e.g. after Add / Clone).
  useEffect(() => {
    if (selectedId && mobileView === "list") {
      const el = document.querySelector('.models-item[data-active="true"]');
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId, mobileView, search, providerFilter]);

  // --- Hooks below must run unconditionally (before any early return) ---
  const cloneModel = useCallback((index: number) => {
    if (!form) return;
    const src = form.models[index];
    if (!src) return;
    const id = nextId();
    const clonedName = src.name?.trim() ? `${src.name.trim()}-copy` : "";
    updateForm((prev) => {
      const newModels = [...prev.models];
      newModels.push({
        ...src,
        _id: id,
        name: clonedName,
        extras: JSON.parse(JSON.stringify(src.extras || {})),
      });
      return { ...prev, models: newModels as HydratedForm["models"] };
    });
    setSelectedId(id);
    setMobileView("detail");
  }, [form, updateForm]);

  // --- Filtering (left list only; the detail pane follows the selection) ---
  const q = search.trim().toLowerCase();
  const filteredIndices = useMemo(() => {
    if (!form) return [];
    return form.models
      .map((_, i) => i)
      .filter((i) => {
        const m = form.models[i];
        const matchesSearch =
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.model.toLowerCase().includes(q) ||
          m.base_url.toLowerCase().includes(q);
        const matchesProvider = providerFilter === "all" || m.provider === providerFilter;
        return matchesSearch && matchesProvider;
      });
  }, [form, q, providerFilter]);

  if (!form || !snapshot) {
    return <PageSkeleton cards={Math.max(2, Math.min(5, form?.models.length || 2))} />;
  }

  const selectedIndex = form.models.findIndex((m) => m._id === selectedId);

  const addModel = () => {
    const id = nextId();
    updateForm((prev) => {
      const newModels = [...prev.models];
      newModels.push({
        _id: id,
        name: "",
        provider: "openai-chat",
        base_url: "",
        api_key: "",
        model: "",
        extras: {},
      });
      return { ...prev, models: newModels as HydratedForm["models"] };
    });
    setSelectedId(id);
    setMobileView("detail");
    setSearch("");
    setProviderFilter("all");
  };

  const selectModel = (id: string) => {
    setSelectedId(id);
    setMobileView("detail");
  };

  const runBatch = async () => {
    if (batch.state === "running") return;
    const targets = form.models
      .filter((m) => m.name?.trim())
      .map((m) => ({ _id: m._id, name: m.name.trim() }));
    if (targets.length === 0) return;

    setBatch({ ...EMPTY_BATCH, state: "running", total: targets.length });
    const results: Record<string, BatchTestEntry> = {};
    let ok = 0;
    let failed = 0;

    for (const tg of targets) {
      results[tg._id] = { state: "testing" };
      setBatch((prev) => ({ ...prev, results: { ...results } }));
      try {
        const r: TestModelResult = await api.testModel(tg.name);
        results[tg._id] = { state: "done", result: r };
        if (r.ok) ok++;
        else failed++;
      } catch (e) {
        results[tg._id] = { state: "done", result: { ok: false, error: e instanceof Error ? e.message : String(e) } };
        failed++;
      }
      setBatch((prev) => ({
        ...prev,
        tested: ok + failed,
        ok,
        failed,
        results: { ...results },
      }));
    }
    setBatch((prev) => ({ ...prev, state: "done" }));
  };

  const namedCount = form.models.filter((m) => m.name?.trim()).length;

  const batchLabel =
    batch.state === "running"
      ? t("models.batchTesting", { done: batch.tested, total: batch.total })
      : batch.state === "done"
        ? t("models.batchDone", { ok: batch.ok, failed: batch.failed })
        : t("models.batchTest");

  return (
    <Flex direction="column" gap="5">
      <PageHeader title={t("models.heading")} description={t("models.meta")}>
        <Button variant="ghost" onClick={refreshConfig}>
          <ReloadIcon />
          {t("common.refresh")}
        </Button>
        <GuardedResetButton />
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
          action={<Button onClick={addModel}><PlusIcon /> {t("models.addFirst")}</Button>}
        />
      ) : (
        <div className="models-split">
          {/* ---- Left: list ---- */}
          <Box className="models-list-col" data-hidden={mobileView === "detail" ? "true" : "false"}>
            <Card size="3">
              <Flex justify="between" align="center" mb="3">
                <Heading size="3">
                  {t("models.count", { count: form.models.length })}
                </Heading>
                <Tooltip content={t("common.addModel")}>
                  <IconButton variant="soft" color="indigo" size="2" onClick={addModel} aria-label={t("common.addModel")}>
                    <PlusIcon />
                  </IconButton>
                </Tooltip>
              </Flex>

              <Flex gap="2" mb="3" align="center">
                <TextField.Root
                  placeholder={t("models.searchPlaceholder")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <TextField.Slot>
                    <MagnifyingGlassIcon />
                  </TextField.Slot>
                </TextField.Root>
                <Select.Root value={providerFilter} onValueChange={setProviderFilter}>
                  <Select.Trigger style={{ minWidth: 140 }} />
                  <Select.Content>
                    <Select.Item value="all">{t("models.filterAll")}</Select.Item>
                    {PROVIDERS.map((p) => (
                      <Select.Item key={p} value={p}>
                        {p}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>

              <Button
                variant="soft"
                size="2"
                mb="3"
                onClick={runBatch}
                disabled={batch.state === "running" || namedCount === 0}
                style={{ width: "100%" }}
              >
                {batch.state === "running" ? <Spinner size="1" /> : <ReloadIcon />}
                {batchLabel}
              </Button>

              <Box className="models-list-scroll">
                {filteredIndices.length === 0 ? (
                  <Box py="4" style={{ textAlign: "center" }}>
                    <Text color="gray" size="2">
                      {t("common.noData")}
                    </Text>
                  </Box>
                ) : (
                  <Flex direction="column" gap="1">
                    {filteredIndices.map((i) => (
                      <ModelListItem
                        key={form.models[i]._id}
                        index={i}
                        active={selectedIndex === i}
                        statusData={statusData}
                        batchResult={batch.results[form.models[i]._id]}
                        onClick={() => selectModel(form.models[i]._id)}
                      />
                    ))}
                  </Flex>
                )}
              </Box>
            </Card>
          </Box>

          {/* ---- Right: detail ---- */}
          <Box className="models-detail-col" data-hidden={mobileView === "detail" ? "false" : "true"}>
            <Button variant="ghost" size="1" mb="3" className="models-back-btn" onClick={() => setMobileView("list")}>
              <ArrowLeftIcon />
              {t("models.backToList")}
            </Button>

            {selectedIndex === -1 ? (
              <EmptyState
                title={t("models.selectPrompt")}
                description={t("models.meta")}
                icon={<LayersIcon />}
                action={<Button onClick={addModel}><PlusIcon /> {t("models.addFirst")}</Button>}
              />
            ) : (
              <ModelDetail index={selectedIndex} statusData={statusData} onClone={cloneModel} />
            )}
          </Box>
        </div>
      )}
    </Flex>
  );
}
