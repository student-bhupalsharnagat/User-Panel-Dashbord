/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { BannerNotice } from './components/layout/BannerNotice';
import { SearchPalette } from './components/layout/SearchPalette';
import { NotificationsDrawer } from './components/layout/NotificationsDrawer';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

// Views
import { DashboardView } from './components/views/DashboardView';
import { MarketWatchView } from './components/views/MarketWatchView';
import { ClientsView } from './components/views/ClientsView';
import { ClientDetailView } from './components/views/ClientDetailView';
import { OrdersView } from './components/views/OrdersView';
import { PositionsView } from './components/views/PositionsView';
import { FundsView } from './components/views/FundsView';
import { LedgerView } from './components/views/LedgerView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ActionLogsView } from './components/views/ActionLogsView';
import { ReportsView } from './components/views/ReportsView';
import { InstrumentsView } from './components/views/InstrumentsView';
import { SettingsView } from './components/views/SettingsView';

// Modals
import { OrderModal } from './components/modals/OrderModal';
import { AddClientModal } from './components/modals/AddClientModal';
import { FundActionModal } from './components/modals/FundActionModal';
import { SquareOffModal } from './components/modals/SquareOffModal';
import { ReportPreviewModal } from './components/modals/ReportPreviewModal';
import { SupportTicketModal } from './components/modals/SupportTicketModal';
import { ToastContainer } from './components/modals/ToastContainer';

const MainLayout: React.FC = () => {
  const { activeTab } = useApp();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'market_watch':
        return <MarketWatchView />;
      case 'clients':
      case 'client_details':
        return <ClientsView />;
      case 'orders':
        return <OrdersView />;
      case 'positions':
        return <PositionsView />;
      case 'funds':
        return <FundsView />;
      case 'account_ledger':
        return <LedgerView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'action_logs':
        return <ActionLogsView />;
      case 'reports':
        return <ReportsView />;
      case 'instruments':
        return <InstrumentsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0b101b] text-slate-100 overflow-hidden font-sans">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Persistent Top Navigation Bar */}
        <TopBar />

        {/* Global Notice Banner */}
        <BannerNotice />

        {/* Dynamic Screen Viewport */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {renderActiveView()}
        </main>

        {/* Mobile Bottom Navigation Bar (< lg) */}
        <MobileBottomNav />
      </div>

      {/* Global Modals & Drawers */}
      <OrderModal />
      <AddClientModal />
      <ClientDetailView />
      <FundActionModal />
      <SquareOffModal />
      <ReportPreviewModal />
      <SupportTicketModal />
      <SearchPalette />
      <NotificationsDrawer />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
