import React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBackgroundProps {
  className?: string;
  position?: 'fixed' | 'absolute';
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className, position = 'fixed' }) => {
  return (
    <div className={cn(
      position === 'fixed' ? 'fixed' : 'absolute', 
      "inset-0 z-[-1] overflow-hidden pointer-events-none", 
      className
    )}>
      <svg
        className="absolute w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
             <stop offset="0%" stopColor="#ef4444" stopOpacity="0.1" />
             <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        
        {/* Floating Shapes - Fitness & Nutrition Theme */}
        
        {/* Red circle - Top Left */}
        <circle cx="10%" cy="15%" r="40" fill="#ef4444" opacity="0.1" className="animate-pulse">
           <animateTransform 
             attributeName="transform"
             type="translate"
             values="0 0; 10 10; 0 0" 
             dur="10s" 
             repeatCount="indefinite" 
           />
        </circle>

        {/* Red circle - Bottom Right */}
        <circle cx="90%" cy="85%" r="60" fill="#ef4444" opacity="0.1" className="animate-pulse">
           <animateTransform 
             attributeName="transform"
             type="translate"
             values="0 0; -15 -15; 0 0" 
             dur="14s" 
             repeatCount="indefinite" 
           />
        </circle>

        {/* Apple (Nutrition) - Top Right Area */}
        <g className="animate-float-slow" fillOpacity="0.8" transform="translate(700, 100)">
            <path 
              d="M37,12 C35,11 33,12 32,14 C31,16 32,19 34,20 C36,21 38,20 39,18 C40,16 39,13 37,12 Z" 
              fill="url(#grad2)" 
              transform="scale(4)"
            >
               <animateTransform 
                 attributeName="transform"
                 type="translate"
                 values="0 0; 20 30; 0 0" 
                 dur="25s" 
                 repeatCount="indefinite" 
               />
            </path>
        </g>
        
        {/* Dumbbell (Workout) - Bottom Left */}
        <g className="animate-float" transform="translate(100, 600)" fillOpacity="0.8">
            <path 
                d="M20,20 L80,80 M15,25 L25,15 M75,85 L85,75 M10,30 L30,10 M70,90 L90,70" 
                stroke="url(#grad2)" 
                strokeWidth="12" 
                strokeLinecap="round"
             >
                <animateTransform 
                     attributeName="transform"
                     type="rotate"
                     values="0 50 50; 10 50 50; 0 50 50" 
                     dur="15s" 
                     repeatCount="indefinite" 
                />
            </path>
        </g>
        
        {/* Dumbbell (Workout) - Top Right */}
        <g className="animate-float" transform="translate(800, 300)" fillOpacity="0.8">
            <path 
                d="M20,20 L80,80 M15,25 L25,15 M75,85 L85,75 M10,30 L30,10 M70,90 L90,70" 
                stroke="url(#grad2)" 
                strokeWidth="10" 
                strokeLinecap="round"
             >
                <animateTransform 
                     attributeName="transform"
                     type="rotate"
                     values="45 50 50; 55 50 50; 45 50 50" 
                     dur="18s" 
                     repeatCount="indefinite" 
                />
            </path>
        </g>

        {/* Heart (cardio) - Center Left */}
        <path 
            d="M850 150 C 850 100, 750 100, 750 150 C 750 200, 850 250, 850 300 C 850 250, 950 200, 950 150 C 950 100, 850 100, 850 150 Z" 
            fill="url(#grad2)" 
            className="animate-float-reverse opacity-80"
            transform="translate(-600, 200) scale(1.0)"
        >
             <animateTransform 
               attributeName="transform"
               type="translate"
               values="0 0; -20 20; 0 0" 
               dur="22s" 
               repeatCount="indefinite" 
             />
        </path>

        {/* Heart (cardio) - Bottom Center */}
        <path 
            d="M850 150 C 850 100, 750 100, 750 150 C 750 200, 850 250, 850 300 C 850 250, 950 200, 950 150 C 950 100, 850 100, 850 150 Z" 
            fill="url(#grad2)" 
            className="animate-float-reverse opacity-60"
            transform="translate(-300, 500) scale(0.6)"
        >
             <animateTransform 
               attributeName="transform"
               type="translate"
               values="0 0; 20 -20; 0 0" 
               dur="28s" 
               repeatCount="indefinite" 
             />
        </path>

        {/* Lightning (Energy) - Random positions */}
         <path 
          d="M100 800 L140 750 L130 780 L180 720 L140 770 L150 740 Z" 
          fill="url(#grad2)" 
          className="animate-pulse-slow opacity-60"
          transform="translate(200,-100) scale(1.5)"
         />
         
         <path 
          d="M100 800 L140 750 L130 780 L180 720 L140 770 L150 740 Z" 
          fill="url(#grad2)" 
          className="animate-pulse-slow opacity-50"
          transform="translate(600,-400) scale(1.2)"
         />


        {/* Wavy threads (simulating ropes or movement) */}
        <path
          d="M0,200 Q250,300 500,200 T1000,200 V1000 H0 Z"
          fill="none"
          stroke="url(#grad1)"
          strokeWidth="4"
          className="opacity-80"
        >
          <animate
            attributeName="d"
            dur="30s"
            repeatCount="indefinite"
            values="
              M0,200 Q250,300 500,200 T1000,200;
              M0,200 Q250,100 500,200 T1000,200;
              M0,200 Q250,300 500,200 T1000,200
            "
          />
        </path>

        {/* EKG / Heartbeat Line - Bolder */}
        <path
          d="M0,500 L200,500 L220,450 L240,550 L260,480 L280,520 L300,500 L1000,500"
          fill="none"
          stroke="url(#grad1)"
          strokeWidth="3"
          className="opacity-90"
        >
           <animate
            attributeName="d"
            dur="25s"
            repeatCount="indefinite"
            values="
              M0,500 L200,500 L220,450 L240,550 L260,480 L280,520 L300,500 L1000,500;
              M0,520 L200,520 L220,470 L240,570 L260,500 L280,540 L300,520 L1000,520;
              M0,500 L200,500 L220,450 L240,550 L260,480 L280,520 L300,500 L1000,500
            "
          />
        </path>
        
        {/* Dynamic Curved Line - Bolder */}
        <path
           d="M-100,800 Q400,600 600,800 T1200,800"
           fill="none"
           stroke="#ef4444"
           strokeWidth="3"
           strokeOpacity="0.3"
        >
             <animate
            attributeName="d"
            dur="35s"
            repeatCount="indefinite"
            values="
               M-100,800 Q400,600 600,800 T1200,800;
               M-100,800 Q400,1000 600,800 T1200,800;
               M-100,800 Q400,600 600,800 T1200,800
            "
          />
        </path>

         {/* Grid lines background (Subtle gymnasium floor / graph feel) - Darker */}
         <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="url(#grad1)" strokeWidth="1" strokeOpacity="0.6"/>
         </pattern>
         <rect width="100%" height="100%" fill="url(#grid)" />


      </svg>
    </div>
  );
};

export default AnimatedBackground;
