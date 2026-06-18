import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { I18nProvider } from "./i18n";
import { ConfigProvider } from "./hooks/ConfigContext";
import { ToastProvider } from "./components/ToastProvider";
import Layout from "./components/Layout";
import ToastListener from "./components/ToastListener";
import UnsavedGuard from "./components/UnsavedGuard";
import ModelsPage from "./pages/ModelsPage";
import FallbackPage from "./pages/FallbackPage";
import EndpointsPage from "./pages/EndpointsPage";
import SettingsPage from "./pages/SettingsPage";
import RecordsPage from "./pages/RecordsPage";
import StatusPage from "./pages/StatusPage";
import PlaygroundPage from "./pages/PlaygroundPage";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <ConfigProvider>
            <HashRouter>
              <UnsavedGuard>
                <ToastListener />
                <Routes>
                  <Route path="/" element={<Navigate to="/models" replace />} />
                  <Route element={<Layout />}>
                    <Route path="/models" element={<ModelsPage />} />
                    <Route path="/fallback" element={<FallbackPage />} />
                    <Route path="/endpoints" element={<EndpointsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/records" element={<RecordsPage />} />
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="/playground" element={<PlaygroundPage />} />
                  </Route>
                </Routes>
              </UnsavedGuard>
            </HashRouter>
          </ConfigProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
