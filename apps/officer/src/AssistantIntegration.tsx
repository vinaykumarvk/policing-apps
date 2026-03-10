/**
 * AssistantIntegration — lazy-loaded wrapper for the NL Assistant module.
 * This file is tree-shaken when VITE_ENABLE_ASSISTANT=false.
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AssistantFab,
  AssistantOverlay,
  useAssistantState,
  useFeatureFlags,
  useKeyboardShortcut,
} from "@puda/nl-assistant";
import "@puda/nl-assistant/nl-assistant.css";
import type { AssistantConfig } from "@puda/nl-assistant";

interface Props {
  appId: string;
  userType: string;
  apiBaseUrl: string;
  authHeaders: Record<string, string>;
  isOffline: boolean;
}

export default function AssistantIntegration({ appId, userType, apiBaseUrl, authHeaders, isOffline }: Props) {
  const { t } = useTranslation();
  const { open, activeTab, setActiveTab, toggle, closeAssistant } = useAssistantState();

  const config: AssistantConfig = { appId, userType, apiBaseUrl, authHeaders, isOffline };
  const { flags, loading: flagsLoading } = useFeatureFlags(config);

  useKeyboardShortcut(useCallback(() => toggle(), [toggle]));

  const anyFeatureEnabled = flags.nl_query || flags.page_agent;
  if (flagsLoading || !anyFeatureEnabled) return null;

  return (
    <>
      <AssistantFab
        onClick={toggle}
        disabled={isOffline}
        label={t("assistant.open")}
      />
      <AssistantOverlay
        open={open}
        onClose={closeAssistant}
        config={config}
        flags={flags}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        t={t}
      />
    </>
  );
}
