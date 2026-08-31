"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/*  TabNavigation — Reusable tab bar with active state styling        */
/* ------------------------------------------------------------------ */

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: string; // FontAwesome class, e.g. "fa-solid fa-calendar"
}

interface TabNavigationProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  /** Extra CSS class on the wrapper. */
  className?: string;
  /** Colour accent for the active tab indicator. Default: "#941A0B". */
  accentColor?: string;
}

export function TabNavigation<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className = "",
  accentColor = "#941A0B",
}: TabNavigationProps<T>) {
  return (
    <div
      className={`flex flex-wrap gap-1 border-b border-slate-200 pb-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-lg
              transition-all duration-200 border-b-2
              ${
                isActive
                  ? "text-white border-transparent shadow-md"
                  : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100"
              }
            `}
            style={
              isActive
                ? { backgroundColor: accentColor, borderBottomColor: accentColor }
                : undefined
            }
          >
            {tab.icon && <i className={tab.icon} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SubTabNavigation — Lighter variant for nested sub-tabs            */
/* ------------------------------------------------------------------ */

interface SubTabNavigationProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
}

export function SubTabNavigation<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: SubTabNavigationProps<T>) {
  return (
    <div
      className={`flex flex-wrap gap-2 border-b border-slate-200 pb-2 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`
              border-b-2 px-4 py-2 text-sm font-bold transition
              ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }
            `}
          >
            {tab.icon && <i className={`${tab.icon} mr-1.5`} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
