import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { I18nProvider } from "./i18n";
import { ConfigProvider } from "./hooks/ConfigContext";
import Layout from "./components/Layout";
import ModelsPage from "./pages/ModelsPage";
import FallbackPage from "./pages/FallbackPage";
import EndpointsPage from "./pages/EndpointsPage";
import SettingsPage from "./pages/SettingsPage";
import RecordsPage from "./pages/RecordsPage";
import StatusPage from "./pages/StatusPage";

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ConfigProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/models" replace />} />
              <Route element={<Layout />}>
                <Route path="/models" element={<ModelsPage />} />
                <Route path="/fallback" element={<FallbackPage />} />
                <Route path="/endpoints" element={<EndpointsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/records" element={<RecordsPage />} />
              </Route>
              <Route path="/status" element={<StatusPage />} />
            </Routes>
          </HashRouter>
        </ConfigProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
