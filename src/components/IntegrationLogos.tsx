import React from 'react';
import jiraLogoSrc from '../assets/jira-logo.png';

/**
 * Exact official vector & brand logos for Slack, Jira, and Google Chat.
 */

export function SlackLogo({ className = 'w-5 h-5', size }: { className?: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 122.8 122.8"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red/Aubergine Left Pill & Drop */}
      <path
        d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
        fill="#E01E5A"
      />
      {/* Cyan/Blue Top Pill & Drop */}
      <path
        d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
        fill="#36C5F0"
      />
      {/* Green Right Pill & Drop */}
      <path
        d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
        fill="#2EB67D"
      />
      {/* Yellow Bottom Pill & Drop */}
      <path
        d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export function JiraLogo({ className = 'w-5 h-5', size }: { className?: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <img
      src={jiraLogoSrc}
      alt="Jira"
      className={`inline-block object-contain rounded-[22%] ${className}`}
      style={style}
    />
  );
}

export function GChatLogo({ className = 'w-5 h-5', size }: { className?: string; size?: number }) {
  const style = size ? { width: size, height: size } : undefined;
  return (
    <svg
      viewBox="0 0 192 192"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top Left Bubble (Workspace Green) */}
      <path
        d="M32 44C32 37.3726 37.3726 32 44 32H116C122.627 32 128 37.3726 128 44V116C128 122.627 122.627 128 116 128H56L32 152V44Z"
        fill="#00AC47"
      />
      {/* Bottom Right Bubble (Deep Green) */}
      <path
        d="M64 76C64 69.3726 69.3726 64 76 64H148C154.627 64 160 69.3726 160 76V148C160 154.627 154.627 160 148 160H88L64 184V76Z"
        fill="#00832D"
      />
      {/* Overlap / Fold Shadow */}
      <path
        d="M64 76C64 69.3726 69.3726 64 76 64H116C122.627 64 128 69.3726 128 76V116C128 122.627 122.627 128 116 128H76C69.3726 128 64 122.627 64 116V76Z"
        fill="#006622"
      />
    </svg>
  );
}
