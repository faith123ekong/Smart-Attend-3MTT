import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className = "w-10 h-10", size }: LogoProps) {
  const style = size ? { width: size, height: size } : {};
  
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        {/* Outer Pin Gradient */}
        <linearGradient id="pin-outer" x1="20" y1="0" x2="80" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        
        {/* Metallic Center Shine */}
        <radialGradient id="metal-shine" cx="50" cy="35" r="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="60%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </radialGradient>

        {/* Checkmark Gradient */}
        <linearGradient id="check-grad" x1="40" y1="25" x2="60" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>

        {/* Depth Shadow */}
        <filter id="inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
          <feOffset dx="1" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Glossy Reflection */}
        <linearGradient id="gloss" x1="50" y1="0" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main Pin Body with 3D-like shape */}
      <path 
        d="M50 98C50 98 12 60 12 35C12 14 29 0 50 0C71 0 88 14 88 35C88 60 50 98 50 98Z" 
        fill="url(#pin-outer)" 
      />

      {/* Glossy Highlight on the Pin */}
      <path 
        d="M50 4C31 4 16 18 16 35C16 45 23 55 33 65" 
        stroke="url(#gloss)" 
        strokeWidth="3" 
        strokeLinecap="round"
      />

      {/* Metallic Center Circle */}
      <circle cx="50" cy="35" r="28" fill="url(#metal-shine)" stroke="#1e293b" strokeWidth="0.5" />
      
      {/* Inner Ring for Metal Texture */}
      <circle cx="50" cy="35" r="24" stroke="white" strokeOpacity="0.3" strokeWidth="1" />

      {/* Checkmark Shadow */}
      <path 
        d="M38 36L46 44L62 28" 
        stroke="#1e1b4b" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        opacity="0.2"
        transform="translate(1, 1)"
      />
      
      {/* Checkmark Main Body */}
      <path 
        d="M38 36L46 44L62 28" 
        stroke="url(#check-grad)" 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        filter="url(#inner-shadow)"
      />
    </svg>
  );
}
