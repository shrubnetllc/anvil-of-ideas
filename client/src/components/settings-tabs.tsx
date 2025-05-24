import { useState } from "react";

interface SettingsTabsProps {
  children: React.ReactNode;
}

interface TabContentProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
}

export function SettingsTabs({ children }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState("email");
  
  return (
    <div className="w-full">
      <div className="border-b border-neutral-200 mb-6">
        <div className="flex space-x-2">
          <TabButton 
            id="email" 
            activeTab={activeTab} 
            onClick={() => setActiveTab("email")}
          >
            Email
          </TabButton>
          <TabButton 
            id="account" 
            activeTab={activeTab} 
            onClick={() => setActiveTab("account")}
          >
            Account
          </TabButton>
          <TabButton 
            id="notifications" 
            activeTab={activeTab} 
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </TabButton>
        </div>
      </div>
      
      {/* Clone children and only render the active one */}
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.props.id === activeTab) {
          return child;
        }
        return null;
      })}
    </div>
  );
}

function TabButton({ 
  id, 
  activeTab, 
  onClick, 
  children 
}: { 
  id: string; 
  activeTab: string; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      className={`px-4 py-2 text-sm font-medium transition-all outline-none ${
        activeTab === id
          ? "border-b-2 border-primary text-primary"
          : "text-neutral-500 hover:text-neutral-800 hover:border-b-2 hover:border-neutral-300"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TabContent({ id, activeTab, children }: TabContentProps) {
  return (
    <div className={`mt-6 space-y-6 ${id === activeTab ? "block" : "hidden"}`}>
      {children}
    </div>
  );
}