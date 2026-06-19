import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Flex, Box, Button, Heading, Text, TextField, Select, IconButton, Tooltip, Badge, Spinner, TextArea, Separator, Popover, Slider, SegmentedControl } from "@radix-ui/themes";
import { ChatBubbleIcon, PlusIcon, Cross2Icon, ImageIcon, ReloadIcon, PaperPlaneIcon, UploadIcon, Link2Icon, GearIcon, ChevronDownIcon, ChevronRightIcon, LightningBoltIcon, TrashIcon } from "@radix-ui/react-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useT } from "../i18n";
import { useConfigContext } from "../hooks/ConfigContext";
import PageHeader from "../components/PageHeader";
import EmptyState from "../components/EmptyState";
import PageSkeleton from "../components/PageSkeleton";
import { formatSpeed } from "../components/health";
import {
  PLAYGROUND_API_LABEL,
  PLAYGROUND_REASONING_EFFORTS,
  PLAYGROUND_ENABLE_THINKING_VALUES,
  type PlaygroundApiType,
  type PlaygroundReasoningEffort,
  type PlaygroundEnableThinking,
} from "../api";
import {
  buildRequestBody,
  endpointForApiType,
  extractDeltaAndUsage,
  parseSSEStream,
  computeTokensPerSecond,
  type PlaygroundImage,
  type PlaygroundUsage,
  type PlaygroundParams,
  type PlaygroundHistoryMessage,
} from "../components/playground/streaming";

interface ModelParams {
  temperature: string;
  topP: string;
  maxTokens: string;
  reasoningEffort: PlaygroundReasoningEffort;
  enableThinking: PlaygroundEnableThinking;
}

const EMPTY_MODEL_PARAMS: ModelParams = { temperature: "", topP: "", maxTokens: "", reasoningEffort: "", enableThinking: "auto" };

interface SelectedModel {
  key: string;
  name: string;
  apiType: PlaygroundApiType;
  params: ModelParams;
}

type ResponseStatus = "streaming" | "done" | "error" | "stopped";

interface ModelResponse {
  content: string;
  reasoning: string;
  status: ResponseStatus;
  error?: string;
  requestId?: string;
  usage?: PlaygroundUsage;
  startedAt?: number;
  endedAt?: number;
}

interface Turn {
  id: string;
  userContent: string;
  images: PlaygroundImage[];
  responses: Record<string, ModelResponse>;
}

let turnIdCounter = 0;
let imageIdCounter = 0;
let modelKeyCounter = 0;

const AVATAR_COLORS = ["indigo", "cyan", "grass", "amber", "crimson", "purple", "orange", "blue"] as const;
type AvatarColor = (typeof AVATAR_COLORS)[number];

function colorForName(name: string): AvatarColor {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function paramSummary(p: ModelParams): string {
  const parts: string[] = [];
  if (p.temperature.trim()) parts.push(`T${p.temperature.trim()}`);
  if (p.topP.trim()) parts.push(`P${p.topP.trim()}`);
  if (p.maxTokens.trim()) parts.push(`M${p.maxTokens.trim()}`);
  if (p.reasoningEffort) parts.push(`E${p.reasoningEffort}`);
  if (p.enableThinking !== "auto") parts.push(`Th:${p.enableThinking}`);
  return parts.join(" ");
}

const API_TYPE_COLOR: Record<PlaygroundApiType, "indigo" | "grass" | "orange"> = {
  "openai-chat": "indigo",
  "openai-responses": "grass",
  "anthropic": "orange",
};

function paramChips(p: ModelParams): { key: string; text: string }[] {
  const chips: { key: string; text: string }[] = [];
  if (p.temperature.trim()) chips.push({ key: "temp", text: `temp ${p.temperature.trim()}` });
  if (p.topP.trim()) chips.push({ key: "topP", text: `top_p ${p.topP.trim()}` });
  if (p.maxTokens.trim()) chips.push({ key: "max", text: `max ${p.maxTokens.trim()}` });
  if (p.reasoningEffort) chips.push({ key: "reason", text: `reason ${p.reasoningEffort}` });
  return chips;
}

export default function PlaygroundPage() {
  const { t } = useT();
  const { snapshot, form } = useConfigContext();

  const [system, setSystem] = useState("");

  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([]);
  const [pendingImages, setPendingImages] = useState<PlaygroundImage[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [attachPopoverOpen, setAttachPopoverOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const apiToken = useMemo(() => {
    const auth = form?.server.auth.api;
    if (auth && auth.enabled === "true" && auth.token) return auth.token;
    return null;
  }, [form]);

  const availableModels = useMemo(() => {
    if (!form) return [];
    const models = form.models.filter((m) => m.name?.trim()).map((m) => ({ name: m.name.trim(), extras: m.extras || {} }));
    const groups = form.fallbackGroups.filter((g) => g.name?.trim()).map((g) => ({ name: g.name.trim(), extras: {} as Record<string, unknown> }));
    return [...models, ...groups];
  }, [form]);

  const modelImageFlag = useCallback((name: string): boolean | undefined => {
    if (!form) return undefined;
    const m = form.models.find((mm) => mm.name === name);
    if (!m) return undefined;
    const v = m.extras?.image;
    return v === undefined ? true : Boolean(v);
  }, [form]);

  useEffect(() => {
    if (form && selectedModels.length === 0 && availableModels.length > 0) {
      setSelectedModels([{ key: `m-${modelKeyCounter++}`, name: availableModels[0].name, apiType: "openai-chat", params: { ...EMPTY_MODEL_PARAMS } }]);
    }
  }, [form, availableModels, selectedModels.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const addModel = (name: string) => {
    if (!name) return;
    setSelectedModels((prev) => [...prev, { key: `m-${modelKeyCounter++}`, name, apiType: "openai-chat", params: { ...EMPTY_MODEL_PARAMS } }]);
  };

  const removeModel = (key: string) => {
    setSelectedModels((prev) => prev.filter((m) => m.key !== key));
    setExpandedModels((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const changeApiType = (key: string, apiType: PlaygroundApiType) => {
    setSelectedModels((prev) => prev.map((m) => (m.key === key ? { ...m, apiType } : m)));
  };

  const updateModelParams = (key: string, patch: Partial<ModelParams>) => {
    setSelectedModels((prev) => prev.map((m) => (m.key === key ? { ...m, params: { ...m.params, ...patch } } : m)));
  };

  const toggleModelExpanded = (key: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setPendingImages((prev) => [...prev, { id: `img-${imageIdCounter++}`, url, mediaType: "", name: url }]);
    setImageUrlInput("");
    setAttachPopoverOpen(false);
  };

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result);
        setPendingImages((prev) => [...prev, { id: `img-${imageIdCounter++}`, url, mediaType: file.type, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
    setAttachPopoverOpen(false);
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  };

  const buildHistoryForModel = useCallback((modelKey: string, upToTurnId: string | null): PlaygroundHistoryMessage[] => {
    const history: PlaygroundHistoryMessage[] = [];
    for (const turn of turns) {
      if (upToTurnId && turn.id === upToTurnId) break;
      const resp = turn.responses[modelKey];
      if (!resp) continue;
      history.push({ role: "user", content: turn.userContent });
      if ((resp.status === "done" || resp.status === "stopped") && resp.content) {
        history.push({ role: "assistant", content: resp.content });
      }
    }
    return history;
  }, [turns]);

  const sendForModel = useCallback(
    async (model: SelectedModel, turnId: string, userContent: string, images: PlaygroundImage[], isRetry: boolean, signal: AbortSignal): Promise<void> => {
      const endpoint = endpointForApiType(model.apiType);
      const history = isRetry ? buildHistoryForModel(model.key, turnId) : buildHistoryForModel(model.key, null);
      const params: PlaygroundParams = { system, temperature: model.params.temperature, topP: model.params.topP, maxTokens: model.params.maxTokens, reasoningEffort: model.params.reasoningEffort, enableThinking: model.params.enableThinking };
      const body = buildRequestBody(model.apiType, {
        ...params,
        modelName: model.name,
        history,
        newContent: userContent,
        images,
      });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-nanollm-source": "playground",
      };
      if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;

      const setResponse = (updater: (prev: ModelResponse) => ModelResponse) => {
        setTurns((prevTurns) => prevTurns.map((tr) => (tr.id === turnId ? { ...tr, responses: { ...tr.responses, [model.key]: updater(tr.responses[model.key] ?? { content: "", reasoning: "", status: "streaming" }) } } : tr)));
      };

      setResponse((p) => ({ ...p, status: "streaming", content: "", reasoning: "", error: undefined, usage: undefined, startedAt: Date.now(), endedAt: undefined }));

      try {
        const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal });
        if (!res.ok) {
          if (signal.aborted) {
            setResponse((p) => ({ ...p, status: "stopped", endedAt: Date.now() }));
            return;
          }
          let errorMsg = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody?.error) errorMsg = typeof errBody.error === "string" ? errBody.error : JSON.stringify(errBody.error);
          } catch {}
          setResponse((p) => ({ ...p, status: "error", error: errorMsg, endedAt: Date.now() }));
          return;
        }
        await parseSSEStream(res, (event) => {
          const { delta, reasoningDelta, usage, done } = extractDeltaAndUsage(model.apiType, event);
          setResponse((p) => ({
            ...p,
            content: delta ? p.content + delta : p.content,
            reasoning: reasoningDelta ? p.reasoning + reasoningDelta : p.reasoning,
            usage: usage ?? p.usage,
            status: done ? "done" : p.status,
            endedAt: done ? Date.now() : p.endedAt,
          }));
        }, signal);
        if (signal.aborted) {
          setResponse((p) => ({ ...p, status: "stopped", endedAt: p.endedAt ?? Date.now() }));
        } else {
          setResponse((p) => (p.status === "streaming" ? { ...p, status: "done", endedAt: p.endedAt ?? Date.now() } : p));
        }
      } catch (e) {
        if (signal.aborted || (e instanceof Error && e.name === "AbortError")) {
          setResponse((p) => ({ ...p, status: "stopped", endedAt: Date.now() }));
        } else {
          setResponse((p) => ({ ...p, status: "error", error: e instanceof Error ? e.message : String(e), endedAt: Date.now() }));
        }
      }
    },
    [buildHistoryForModel, system, apiToken],
  );

  const send = useCallback(async () => {
    if (sending) return;
    const content = input.trim();
    if (!content && pendingImages.length === 0) return;
    if (selectedModels.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const turnId = `turn-${turnIdCounter++}`;
    const images = [...pendingImages];
    const responses: Record<string, ModelResponse> = {};
    for (const m of selectedModels) {
      responses[m.key] = { content: "", reasoning: "", status: "streaming" };
    }
    setTurns((prev) => [...prev, { id: turnId, userContent: content, images, responses }]);
    setInput("");
    setPendingImages([]);
    setSending(true);

    try {
      await Promise.all(selectedModels.map((m) => sendForModel(m, turnId, content, images, false, controller.signal)));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }, [sending, input, pendingImages, selectedModels, sendForModel]);

  const retryModel = useCallback(async (turnId: string, model: SelectedModel) => {
    const turn = turns.find((tr) => tr.id === turnId);
    if (!turn) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSending(true);
    setTurns((prev) => prev.map((tr) => (tr.id === turnId ? { ...tr, responses: { ...tr.responses, [model.key]: { content: "", reasoning: "", status: "streaming" } } } : tr)));
    try {
      await sendForModel(model, turnId, turn.userContent, turn.images, true, controller.signal);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSending(false);
    }
  }, [turns, sendForModel]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const useSuggestion = (text: string) => {
    setInput(text);
  };

  if (!form || !snapshot) {
    return <PageSkeleton cards={3} />;
  }

  if (availableModels.length === 0) {
    return (
      <Flex direction="column" gap="5" p="6">
        <PageHeader title={t("playground.heading")} description={t("playground.meta")} />
        <EmptyState title={t("playground.noModels")} description={t("playground.meta")} icon={<ChatBubbleIcon />} />
      </Flex>
    );
  }

  const canSend = !sending && selectedModels.length > 0 && (input.trim().length > 0 || pendingImages.length > 0);

  return (
    <Box className={`playground-shell${drawerOpen ? " playground-shell--drawer-open" : ""}`} style={{ height: "100%", minHeight: 0 }}>
      {/* Main column */}
      <Flex className="playground-main" direction="column" style={{ height: "100%", minHeight: 0 }}>
        <PageHeader title={t("playground.heading")} description={t("playground.meta")}>
          <Flex align="center" gap="2" wrap="wrap">
            {!drawerOpen && (
            <Flex className="playground-model-strip" align="center" gap="2">
              {selectedModels.map((m) => {
                const color = colorForName(m.name);
                const summary = paramSummary(m.params);
                return (
                  <Tooltip key={m.key} content={`${m.name} · ${PLAYGROUND_API_LABEL[m.apiType]}${summary ? " · " + summary : ""}`}>
                    <Badge variant="soft" color={color} size="1" className="playground-header-badge">
                      <Box style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: `var(--${color}-9)`, flexShrink: 0 }} />
                      <span className="app-truncate">{m.name}</span>
                      {summary && <span className="playground-header-summary">{summary}</span>}
                    </Badge>
                  </Tooltip>
                );
              })}
            </Flex>
            )}
            {!drawerOpen && (
            <Tooltip content={t("playground.openDrawer")}>
              <IconButton variant="soft" size="2" onClick={() => setDrawerOpen(true)} aria-label={t("playground.openDrawer")}>
                <GearIcon />
              </IconButton>
            </Tooltip>
            )}
            {sending ? (
              <Button variant="soft" color="red" size="2" onClick={stop}>
                <span className="playground-stop-icon" />
                {t("playground.stop")}
              </Button>
            ) : null}
          </Flex>
        </PageHeader>

        {/* Message scroll */}
        <Box ref={scrollRef} className="playground-msg-scroll">
          <Box className="playground-msg-inner">
            {turns.length === 0 ? (
              <Flex direction="column" align="center" justify="center" gap="4" py="9" px="4" style={{ minHeight: "100%" }}>
                <Flex align="center" justify="center" width="56px" height="56px" style={{ borderRadius: "var(--radius-4)", backgroundColor: "var(--indigo-3)", color: "var(--indigo-10)" }}>
                  <ChatBubbleIcon width="28" height="28" />
                </Flex>
                <Flex direction="column" align="center" gap="1">
                  <Heading size="4" weight="bold">{t("playground.empty")}</Heading>
                  <Text size="2" color="gray" align="center">{t("playground.tryPrompt")}</Text>
                </Flex>
                <Flex direction="column" gap="2" style={{ width: "100%", maxWidth: 520 }}>
                  {[t("playground.suggestion1"), t("playground.suggestion2"), t("playground.suggestion3")].map((s, i) => (
                    <button key={i} type="button" className="playground-suggestion" onClick={() => useSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </Flex>
              </Flex>
            ) : (
              <Flex direction="column" gap="5">
                {turns.map((turn) => (
                  <TurnView key={turn.id} turn={turn} selectedModels={selectedModels} onRetry={retryModel} sending={sending} />
                ))}
              </Flex>
            )}
          </Box>
        </Box>

        {/* Composer */}
        <Box className="playground-composer">
          <Box className="playground-composer-inner">
            {pendingImages.length > 0 && (
              <Flex gap="2" wrap="wrap" mb="2">
                {pendingImages.map((img) => (
                  <Box key={img.id} style={{ position: "relative", width: 64, height: 64, borderRadius: 6, overflow: "hidden", border: "1px solid var(--gray-5)" }}>
                    <img src={img.url} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <IconButton
                      variant="solid"
                      color="red"
                      size="1"
                      onClick={() => removeImage(img.id)}
                      style={{ position: "absolute", top: 2, right: 2, padding: 2 }}
                      aria-label={t("playground.removeImage")}
                    >
                      <Cross2Icon />
                    </IconButton>
                  </Box>
                ))}
              </Flex>
            )}

            <Box className="playground-composer-input">
              <Popover.Root open={attachPopoverOpen} onOpenChange={setAttachPopoverOpen}>
                <Popover.Trigger>
                  <IconButton variant="ghost" size="2" aria-label={t("playground.attachImage")} className="playground-composer-btn">
                    <ImageIcon />
                  </IconButton>
                </Popover.Trigger>
                <Popover.Content width="320px" align="start">
                  <Flex direction="column" gap="3">
                    <Button variant="soft" onClick={() => fileInputRef.current?.click()}>
                      <UploadIcon />
                      {t("playground.attachImage")}
                    </Button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
                    <Separator size="4" />
                    <Flex gap="2" align="center">
                      <TextField.Root
                        placeholder={t("playground.pasteImageUrl")}
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImageUrl(); } }}
                        style={{ flex: 1 }}
                      >
                        <TextField.Slot><Link2Icon /></TextField.Slot>
                      </TextField.Root>
                      <IconButton variant="soft" onClick={addImageUrl} aria-label={t("playground.addImage")}>
                        <PlusIcon />
                      </IconButton>
                    </Flex>
                  </Flex>
                </Popover.Content>
              </Popover.Root>

              <TextArea
                className="playground-composer-textarea"
                placeholder={t("playground.placeholder")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                }}
                rows={1}
              />

              <IconButton
                variant="solid"
                color="indigo"
                size="2"
                className="playground-composer-btn playground-composer-send"
                onClick={() => void send()}
                disabled={!canSend}
                aria-label={t("playground.send")}
              >
                {sending ? <Spinner size="1" /> : <PaperPlaneIcon />}
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Flex>

      {drawerOpen && (
        <Box className="playground-drawer" role="dialog" aria-label={t("playground.settings")}>
            <Flex align="center" justify="between" className="playground-drawer-head">
              <Flex align="center" gap="2">
                <GearIcon />
                <Heading size="4" weight="bold">{t("playground.settings")}</Heading>
              </Flex>
              <IconButton variant="ghost" size="2" aria-label={t("playground.closeDrawer")} onClick={() => setDrawerOpen(false)}>
                <Cross2Icon />
              </IconButton>
            </Flex>

            <Box className="playground-drawer-body">
              {/* Global system prompt */}
              <Box className="playground-drawer-section">
                <Text as="label" size="2" weight="bold" className="playground-drawer-section-title">{t("playground.systemPromptGlobal")}</Text>
                <TextArea
                  mt="2"
                  placeholder={t("playground.systemPromptPlaceholder")}
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  rows={4}
                  className="playground-drawer-textarea"
                />
                <Flex align="center" justify="between" mt="2">
                  <Text size="1" color="gray" as="p">{t("playground.systemPromptPlaceholder")}</Text>
                  <Badge variant="soft" color="gray" size="1">{system.length}</Badge>
                </Flex>
              </Box>

              {/* Models list */}
              <Box className="playground-drawer-section">
                <Text as="label" size="2" weight="bold" className="playground-drawer-section-title">{t("playground.modelsHeading")}</Text>

                {/* Add model — prominent action at top */}
                <Box mt="2">
                  <Select.Root value="" onValueChange={(v) => addModel(v)}>
                    <Select.Trigger className="playground-add-model-btn" placeholder={t("playground.addModel")} style={{ width: "100%" }}>
                      <Flex as="span" align="center" gap="2" justify="center">
                        <PlusIcon />
                        <Text size="2" weight="medium">{t("playground.addModel")}</Text>
                      </Flex>
                    </Select.Trigger>
                    <Select.Content>
                      {availableModels.map((m) => (
                        <Select.Item key={m.name} value={m.name}>{m.name}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </Box>

                <Flex direction="column" gap="2" mt="3">
                  {selectedModels.map((m) => {
                    const imageFlag = modelImageFlag(m.name);
                    const expanded = expandedModels.has(m.key);
                    const chips = paramChips(m.params);
                    return (
                      <Box key={m.key} className="playground-model-row">
                        <Flex direction="column" gap="2">
                          {/* Clickable header row */}
                          <Box
                            className="playground-model-row-head"
                            role="button"
                            tabIndex={0}
                            aria-label={expanded ? t("playground.collapseModel") : t("playground.expandModel")}
                            onClick={() => toggleModelExpanded(m.key)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleModelExpanded(m.key);
                              }
                            }}
                          >
                            <Flex align="center" gap="2">
                              <Box className="playground-model-chev">
                                {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                              </Box>
                              <Box style={{ minWidth: 0, flex: 1 }}>
                                <Text size="2" weight="medium" className="app-truncate" style={{ display: "block" }}>{m.name}</Text>
                              </Box>
                              <Badge variant="soft" color={API_TYPE_COLOR[m.apiType]} size="1">{PLAYGROUND_API_LABEL[m.apiType]}</Badge>
                              {imageFlag === false && (
                                <Tooltip content={t("playground.imageDegradedTip")}>
                                  <Badge variant="soft" color="amber" size="1">{t("playground.imageDegraded")}</Badge>
                                </Tooltip>
                              )}
                              <Tooltip content={t("playground.removeModel")}>
                                <IconButton
                                  variant="ghost"
                                  color="red"
                                  size="1"
                                  onClick={(e) => { e.stopPropagation(); removeModel(m.key); }}
                                  aria-label={t("playground.removeModel")}
                                >
                                  <TrashIcon />
                                </IconButton>
                              </Tooltip>
                            </Flex>
                          </Box>

                          {/* Collapsed: param overview chips */}
                          {!expanded && chips.length > 0 && (
                            <Flex gap="2" wrap="wrap" pl="5" className="playground-param-chips">
                              {chips.map((c) => (
                                <Text key={c.key} as="span" size="1" className="playground-param-chip">{c.text}</Text>
                              ))}
                            </Flex>
                          )}

                          {/* Expanded: sectioned params */}
                          {expanded && (
                            <Box className="playground-model-params" pl="5">
                              {/* ── Protocol ── */}
                              <Flex align="center" gap="2" mb="2">
                                <Text size="1" weight="bold" className="playground-param-group-title">{t("playground.paramGroupProtocol")}</Text>
                                <Separator style={{ flex: 1 }} />
                              </Flex>
                              <Select.Root value={m.apiType} onValueChange={(v) => changeApiType(m.key, v as PlaygroundApiType)}>
                                <Select.Trigger style={{ width: "100%" }} />
                                <Select.Content>
                                  {(Object.keys(PLAYGROUND_API_LABEL) as PlaygroundApiType[]).map((api) => (
                                    <Select.Item key={api} value={api}>{PLAYGROUND_API_LABEL[api]}</Select.Item>
                                  ))}
                                </Select.Content>
                              </Select.Root>

                              {/* ── Sampling ── */}
                              <Flex align="center" gap="2" mt="3" mb="2">
                                <Text size="1" weight="bold" className="playground-param-group-title">{t("playground.paramGroupSampling")}</Text>
                                <Separator style={{ flex: 1 }} />
                              </Flex>

                              {/* temperature slider row */}
                              <Flex className="playground-param-slider-row" align="center" gap="2">
                                <Text as="label" size="1" color="gray" weight="medium" className="playground-param-slider-label">{t("playground.temperature")}</Text>
                                <Slider
                                  className="playground-param-slider"
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  value={[parseFloat(m.params.temperature) || 0]}
                                  onValueChange={([v]) => updateModelParams(m.key, { temperature: String(Math.round(v * 10) / 10) })}
                                />
                                <TextField.Root
                                  className="playground-param-slider-input"
                                  size="1"
                                  placeholder="0.7"
                                  value={m.params.temperature}
                                  onChange={(e) => updateModelParams(m.key, { temperature: e.target.value })}
                                />
                                <Text as="span" size="1" color="gray" className="playground-param-range-badge">0–2</Text>
                              </Flex>

                              {/* top_p slider row */}
                              <Flex className="playground-param-slider-row" align="center" gap="2" mt="2">
                                <Text as="label" size="1" color="gray" weight="medium" className="playground-param-slider-label">{t("playground.topP")}</Text>
                                <Slider
                                  className="playground-param-slider"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={[parseFloat(m.params.topP) || 0]}
                                  onValueChange={([v]) => updateModelParams(m.key, { topP: String(Math.round(v * 100) / 100) })}
                                />
                                <TextField.Root
                                  className="playground-param-slider-input"
                                  size="1"
                                  placeholder="1.0"
                                  value={m.params.topP}
                                  onChange={(e) => updateModelParams(m.key, { topP: e.target.value })}
                                />
                                <Text as="span" size="1" color="gray" className="playground-param-range-badge">0–1</Text>
                              </Flex>

                              {/* max_tokens row */}
                              <Flex align="center" gap="2" mt="2">
                                <Text as="label" size="1" color="gray" weight="medium" className="playground-param-field-label">{t("playground.maxTokens")}</Text>
                                <TextField.Root
                                  className="playground-param-field-input"
                                  size="1"
                                  placeholder="4096"
                                  value={m.params.maxTokens}
                                  onChange={(e) => updateModelParams(m.key, { maxTokens: e.target.value })}
                                />
                                {m.apiType === "anthropic" ? (
                                  <Badge variant="soft" color="red" size="1">{t("playground.maxTokensRequired")}</Badge>
                                ) : (
                                  <Badge variant="soft" color="gray" size="1">{t("playground.maxTokensOptional")}</Badge>
                                )}
                              </Flex>
                              <Text size="1" color="gray" mt="1" as="p">{t("playground.maxTokensHelper")}</Text>

                              {/* ── Reasoning ── */}
                              <Flex align="center" gap="2" mt="3" mb="2">
                                <Text size="1" weight="bold" className="playground-param-group-title">{t("playground.paramGroupReasoning")}</Text>
                                <Separator style={{ flex: 1 }} />
                              </Flex>

                              {/* reasoning_effort */}
                              <Flex align="center" gap="2">
                                <Text as="label" size="1" color="gray" weight="medium" className="playground-param-field-label">{t("playground.reasoningEffort")}</Text>
                                <Box style={{ flex: 1 }}>
                                  <Select.Root
                                    value={m.params.reasoningEffort || "__none__"}
                                    onValueChange={(v) => updateModelParams(m.key, { reasoningEffort: v === "__none__" ? "" : (v as PlaygroundReasoningEffort) })}
                                    disabled={(m.apiType === "openai-responses" || m.apiType === "anthropic") && m.params.enableThinking === "off"}
                                  >
                                    <Select.Trigger style={{ width: "100%" }} />
                                    <Select.Content>
                                      <Select.Item value="__none__">{t("playground.reasoningEffortNone")}</Select.Item>
                                      {PLAYGROUND_REASONING_EFFORTS.map((r) => (
                                        <Select.Item key={r} value={r}>{r}</Select.Item>
                                      ))}
                                    </Select.Content>
                                  </Select.Root>
                                </Box>
                              </Flex>
                              {(m.apiType === "openai-responses" || m.apiType === "anthropic") && m.params.enableThinking === "off" && (
                                <Text size="1" color="amber" mt="1" as="p">{t("playground.reasoningEffortDisabledTip")}</Text>
                              )}

                              {/* enable_thinking SegmentedControl */}
                              <Flex align="center" gap="2" mt="2">
                                <Text as="label" size="1" color="gray" weight="medium" className="playground-param-field-label">{t("playground.enableThinking")}</Text>
                                <SegmentedControl.Root
                                  size="1"
                                  value={m.params.enableThinking}
                                  onValueChange={(v) => updateModelParams(m.key, { enableThinking: v as PlaygroundEnableThinking })}
                                  style={{ flex: 1 }}
                                >
                                  {PLAYGROUND_ENABLE_THINKING_VALUES.map((v) => (
                                    <SegmentedControl.Item key={v} value={v}>
                                      {t(`playground.enableThinking${v.charAt(0).toUpperCase() + v.slice(1)}`)}
                                    </SegmentedControl.Item>
                                  ))}
                                </SegmentedControl.Root>
                              </Flex>

                              {/* reasoning hint per API type */}
                              <Text size="1" color="gray" mt="2" as="p">
                                {m.apiType === "openai-chat"
                                  ? t("playground.reasoningHintChat")
                                  : m.apiType === "openai-responses"
                                    ? t("playground.reasoningHintResponses")
                                    : t("playground.reasoningHintAnthropic")}
                              </Text>
                            </Box>
                          )}
                        </Flex>
                      </Box>
                    );
                  })}
                </Flex>
              </Box>
            </Box>
        </Box>
      )}

    </Box>
  );
}

// ─── Turn view ───────────────────────────────────────────────────────────────

interface TurnViewProps {
  turn: Turn;
  selectedModels: SelectedModel[];
  onRetry: (turnId: string, model: SelectedModel) => void;
  sending: boolean;
}

function TurnView({ turn, selectedModels, onRetry, sending }: TurnViewProps) {
  const { t } = useT();
  const single = selectedModels.length <= 1;

  return (
    <Flex direction="column" gap="3">
      {/* User bubble */}
      <Flex justify="end">
        <Box className="playground-bubble-user">
          <Text size="1" weight="bold" color="indigo" className="playground-bubble-author">{t("playground.userLabel")}</Text>
          <Text size="2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{turn.userContent}</Text>
          {turn.images.length > 0 && (
            <Flex gap="2" mt="2" wrap="wrap">
              {turn.images.map((img) => (
                <Box key={img.id} style={{ width: 56, height: 56, borderRadius: 4, overflow: "hidden", border: "1px solid var(--gray-5)" }}>
                  <img src={img.url} alt={img.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </Box>
              ))}
            </Flex>
          )}
        </Box>
      </Flex>

      {/* Assistant turn grid */}
      <Box
        className="playground-assistant-grid"
        style={{
          display: "grid",
          gridTemplateColumns: single ? "1fr" : `repeat(${selectedModels.length}, minmax(0, 1fr))`,
          gap: 12,
          maxWidth: single ? "75%" : "100%",
        }}
      >
        {selectedModels.map((m) => {
          const resp = turn.responses[m.key];
          if (!resp) return <Box key={m.key} />;
          return <ModelColumn key={m.key} model={m} response={resp} onRetry={() => onRetry(turn.id, m)} sending={sending} />;
        })}
      </Box>
    </Flex>
  );
}

interface ModelColumnProps {
  model: SelectedModel;
  response: ModelResponse;
  onRetry: () => void;
  sending: boolean;
}

function ModelColumn({ model, response, onRetry, sending }: ModelColumnProps) {
  const { t } = useT();
  const color = colorForName(model.name);
  const summary = paramSummary(model.params);
  const statusColor: "green" | "red" | "blue" | "gray" =
    response.status === "done" ? "green" : response.status === "error" ? "red" : response.status === "streaming" ? "blue" : "gray";
  const statusText =
    response.status === "streaming" ? t("playground.statusStreaming") :
    response.status === "done" ? t("playground.statusDone") :
    response.status === "error" ? t("playground.statusError") :
    response.status === "stopped" ? t("playground.statusStopped") : "-";
  const tps = computeTokensPerSecond(response.usage?.outputTokens, response.startedAt, response.endedAt);

  const hasReasoning = response.reasoning.length > 0;
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const wasStreamingRef = useRef(false);
  useEffect(() => {
    if (response.status === "streaming") {
      wasStreamingRef.current = true;
      if (hasReasoning && !reasoningOpen) setReasoningOpen(true);
    } else if (wasStreamingRef.current) {
      wasStreamingRef.current = false;
      if (reasoningOpen) setReasoningOpen(false);
    }
  }, [response.status, hasReasoning]);

  return (
    <Box className="playground-bubble-assistant" style={{ borderLeftColor: `var(--${color}-9)` }}>
      <Flex justify="between" align="center" gap="2" mb="2">
        <Flex align="center" gap="2" style={{ minWidth: 0 }}>
          <Box className="playground-avatar" style={{ backgroundColor: `var(--${color}-3)`, color: `var(--${color}-11)` }}>
            {model.name.slice(0, 1).toUpperCase()}
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text size="2" weight="medium" className="app-truncate" style={{ display: "block" }}>{model.name}</Text>
            <Text size="1" color="gray" className="app-truncate" style={{ display: "block" }}>
              {PLAYGROUND_API_LABEL[model.apiType]}{summary ? ` · ${summary}` : ""}
            </Text>
          </Box>
        </Flex>
        <Flex align="center" gap="1" style={{ flexShrink: 0 }}>
          {response.status === "error" && (
            <Tooltip content={t("playground.retry")}>
              <IconButton variant="soft" color="indigo" size="1" onClick={onRetry} disabled={sending} aria-label={t("playground.retry")}>
                <ReloadIcon />
              </IconButton>
            </Tooltip>
          )}
        </Flex>
      </Flex>

      <Box style={{ flex: "1 1 auto" }}>
        {hasReasoning && (
          <Box className="playground-thinking" mb="2">
            <button
              type="button"
              className="playground-thinking-toggle"
              onClick={() => setReasoningOpen((v) => !v)}
              aria-expanded={reasoningOpen}
            >
              {reasoningOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
              <LightningBoltIcon />
              {t("playground.thinking")}
              {response.status === "streaming" && <Spinner size="1" />}
            </button>
            {reasoningOpen && (
              <Box className="playground-thinking-body">
                <Text size="2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{response.reasoning}</Text>
              </Box>
            )}
          </Box>
        )}

        {response.status === "error" ? (
          <Text size="2" color="red" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{response.error}</Text>
        ) : response.content ? (
          <Box className="playground-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.content}</ReactMarkdown>
            {response.status === "streaming" && <span className="playground-cursor">▋</span>}
          </Box>
        ) : (
          <Text size="2" color="gray">{response.status === "streaming" ? t("playground.statusStreaming") : "-"}</Text>
        )}
      </Box>

      <Separator size="4" my="2" />
      <Flex gap="2" align="center" wrap="wrap">
        <Badge variant="soft" color={statusColor} size="1">{statusText}</Badge>
        {response.usage ? (
          <Text size="1" color="gray">
            {t("playground.usageInput")} {response.usage.inputTokens ?? "-"}
            {" · "}
            {t("playground.usageOutput")} {response.usage.outputTokens ?? "-"}
            {" · "}
            {t("playground.usageCacheHit")} {response.usage.cacheReadInputTokens ?? "-"}
            {" · "}
            {formatSpeed(tps)}
          </Text>
        ) : response.status === "streaming" ? (
          <Text size="1" color="gray">…</Text>
        ) : (
          <Text size="1" color="gray">{t("playground.noUsage")}</Text>
        )}
      </Flex>
    </Box>
  );
}
