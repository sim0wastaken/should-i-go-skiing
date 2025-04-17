"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

// Snowflake interface
interface Snowflake {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  initialX: number;
  velocityX: number;
  velocityY: number;
}

export default function Home() {
  const [stage, setStage] = useState<"question" | "loading" | "answer">("question");
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMouseMoving, setIsMouseMoving] = useState(false);
  const [prevMousePosition, setPrevMousePosition] = useState({ x: 0, y: 0 });
  const animationFrameId = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track mouse movement
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPrevMousePosition({ x: mousePosition.x, y: mousePosition.y });
      setMousePosition({ x: e.clientX, y: e.clientY });
      setIsMouseMoving(true);
      
      // Reset mouse movement flag after a short delay
      clearTimeout(mouseTimeoutRef.current);
      mouseTimeoutRef.current = window.setTimeout(() => {
        setIsMouseMoving(false);
      }, 200); // Increased to ensure mouse is considered "moving" longer
    };
    
    const mouseTimeoutRef = { current: 0 };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(mouseTimeoutRef.current);
    };
  }, []); // Remove mousePosition dependency to prevent infinite loop

  // Store mouse position in ref to avoid animation loop recreations
  const mousePositionRef = useRef({ current: { x: 0, y: 0 }, prev: { x: 0, y: 0 } });
  
  // Update ref when state changes
  useEffect(() => {
    mousePositionRef.current = {
      current: { ...mousePosition },
      prev: { ...prevMousePosition }
    };
  }, [mousePosition, prevMousePosition]);

  // Initialize snowflakes
  useEffect(() => {
    const generateSnowflakes = () => {
      const flakes: Snowflake[] = [];
      const count = 60; // Increased count for better effect
      
      for (let i = 0; i < count; i++) {
        const initialX = Math.random() * 100; // Initial position as percentage
        flakes.push({
          id: i,
          x: initialX,
          y: Math.random() * 100,
          size: 8 + Math.random() * 14,
          speed: 0.05 + Math.random() * 0.1,
          opacity: 0.5 + Math.random() * 0.5,
          initialX,
          velocityX: 0,
          velocityY: 0
        });
      }
      
      return flakes;
    };
    
    setSnowflakes(generateSnowflakes());
    
    // Start animation loop
    const animateSnowflakes = () => {
      // Use ref values for mouse position to ensure most current values
      const mousePos = mousePositionRef.current.current;
      const prevMousePos = mousePositionRef.current.prev;
      
      const mouseX = (mousePos.x / (window.innerWidth || 1)) * 100; 
      const mouseY = (mousePos.y / (window.innerHeight || 1)) * 100;
      
      // Calculate mouse velocity
      const prevMouseX = (prevMousePos.x / (window.innerWidth || 1)) * 100;
      const prevMouseY = (prevMousePos.y / (window.innerHeight || 1)) * 100;
      const mouseVelocityX = mouseX - prevMouseX;
      const mouseVelocityY = mouseY - prevMouseY;
      const mouseSpeed = Math.sqrt(mouseVelocityX * mouseVelocityX + mouseVelocityY * mouseVelocityY);
      
      // Limit the mouse speed to prevent extreme reactions but keep it meaningful
      const cappedMouseSpeed = Math.min(mouseSpeed, 12);
      
      setSnowflakes(prevFlakes => {
        // First pass: calculate new positions based on mouse interaction
        const updatedFlakes = prevFlakes.map(flake => {
          // Natural falling movement
          let velocityY = flake.velocityY;
          
          // Add slight gravity for natural falling
          velocityY += 0.0005;
          velocityY = Math.min(velocityY, flake.speed); // Terminal velocity
          
          // Calculate horizontal movement
          let velocityX = flake.velocityX;
          
          // Size factor affects physics (smaller = move more)
          const sizeFactor = 1 - ((flake.size - 8) / 14); // 1 for smallest, 0 for largest
          
          // Mass is proportional to size (area)
          const flakeMass = flake.size * flake.size;
          
          // Mouse repulsion parameters
          const minSafeDistance = 5; // Minimum distance snowflakes can get to mouse (percentage units)
          const repulsionRadius = 4 + (cappedMouseSpeed * 0.2); // Expanded radius for early repulsion
          
          // Calculate distance from mouse
          const distX = mouseX - flake.x;
          const distY = mouseY - flake.y;
          const dist = Math.sqrt(distX * distX + distY * distY);
          
          // Direction of potential force (away from mouse)
          const angle = Math.atan2(distY, distX);
          
          // Strong repulsion from mouse - never allows flakes to touch cursor
          if (dist < repulsionRadius) {
            // Calculate normalized distance (0 = at minimum safe distance, 1 = at edge of repulsion radius)
            const normalizedDist = Math.max(0, (dist - minSafeDistance) / (repulsionRadius - minSafeDistance));
            
            // Power curve creates very strong force when close, dropping off as distance increases
            // Use aggressive curve to ensure particles can never touch the mouse
            const repulsionPower = Math.pow(1 - normalizedDist, 3);
            
            // Stronger base repulsion for cursor proximity
            const baseRepulsionStrength = 0.6;
            
            // Extremely strong repulsion when approaching minimum distance
            // Scale with mouse speed for more dramatic effect when moving quickly
            const speedFactor = 1 + (cappedMouseSpeed * 0.1);
            
            // Calculate repulsion force - inversely proportional to mass (smaller = pushed more)
            const repulsionStrength = baseRepulsionStrength * repulsionPower * speedFactor / Math.sqrt(flakeMass);
            
            // Apply different mechanics based on distance - creates a layered force field
            if (dist < minSafeDistance * 1.5) {
              // Emergency repulsion - extremely strong push directly away from cursor
              // This ensures flakes never touch the cursor even with rapid movements
              const emergencyFactor = 10 * (1 - (dist / (minSafeDistance * 1.5)));
              velocityX -= Math.cos(angle) * repulsionStrength * emergencyFactor;
              velocityY -= Math.sin(angle) * repulsionStrength * emergencyFactor;
              
              // Add strong perpendicular force for particles very close to cursor
              // Creates a swirling effect around cursor while maintaining distance
              const perpAngle = angle + Math.PI / 2;
              velocityX += Math.cos(perpAngle) * repulsionStrength * 0.5;
              velocityY += Math.sin(perpAngle) * repulsionStrength * 0.5;
            } else {
              // Normal repulsion for particles in the general influence area
              velocityX -= Math.cos(angle) * repulsionStrength * (1 + cappedMouseSpeed * 0.2);
              velocityY -= Math.sin(angle) * repulsionStrength * (1 + cappedMouseSpeed * 0.2);
              
              // Flow effect (carries in direction of mouse movement)
              // Creates a wake effect behind the cursor
              const wakeEffect = 0.1 * (cappedMouseSpeed + 0.5) * sizeFactor;
              const wakeMultiplier = Math.max(0, normalizedDist);
              velocityX += mouseVelocityX * wakeEffect * wakeMultiplier;
              velocityY += mouseVelocityY * wakeEffect * wakeMultiplier;
              
              // Create vortex effect only for particles at medium distance
              if (normalizedDist > 0.3 && normalizedDist < 0.7) {
                const vortexStrength = 0.04 * (cappedMouseSpeed + 1) * sizeFactor;
                const vortexAngle = angle + Math.PI / 2; // 90 degrees to create rotation
                velocityX += Math.cos(vortexAngle) * vortexStrength;
                velocityY += Math.sin(vortexAngle) * vortexStrength;
              }
              
              // Add some turbulence for more natural movement
              if (Math.random() < 0.1) {
                const turbulenceStrength = 0.2 * repulsionPower * sizeFactor;
                velocityX += (Math.random() - 0.5) * turbulenceStrength;
                velocityY += (Math.random() - 0.5) * turbulenceStrength;
              }
            }
          } else {
            // Air resistance - gradually return to natural state
            velocityX *= 0.96;
            
            // Return to natural vertical falling when not affected
            velocityY = velocityY * 0.98 + (flake.speed * 0.02);
            
            // Gradually return to original horizontal position
            const returnForce = (flake.initialX - flake.x) * 0.0008;
            velocityX += returnForce;
          }
          
          // Apply velocity to position
          let newX = flake.x + velocityX;
          let newY = flake.y + velocityY;
          
          // Enhanced border bouncing physics
          // Define borders with slight margin for visual appeal
          const leftBorder = -1;
          const rightBorder = 99;
          const topBorder = -1;
          const bottomBorder = 99;
          
          // Bounce coefficient - higher = more bouncy (1.0 would be perfect elastic bounce)
          const bounceFactor = 0.7;
          
          // Left and right borders bouncing
          if (newX < leftBorder) {
            // Left border collision
            newX = leftBorder + (leftBorder - newX) * bounceFactor; // Reflect position
            velocityX = Math.abs(velocityX) * bounceFactor; // Reverse and dampen velocity
            
            // Add slight vertical randomization on bounce for natural effect
            velocityY += (Math.random() - 0.5) * 0.03;
          } else if (newX > rightBorder) {
            // Right border collision
            newX = rightBorder - (newX - rightBorder) * bounceFactor; // Reflect position
            velocityX = -Math.abs(velocityX) * bounceFactor; // Reverse and dampen velocity
            
            // Add slight vertical randomization on bounce for natural effect
            velocityY += (Math.random() - 0.5) * 0.03;
          }
          
          // Top and bottom borders bouncing
          if (newY < topBorder) {
            // Top border collision
            newY = topBorder + (topBorder - newY) * bounceFactor; // Reflect position
            velocityY = Math.abs(velocityY) * bounceFactor; // Reverse and dampen velocity
            
            // Add slight horizontal randomization on bounce for natural effect
            velocityX += (Math.random() - 0.5) * 0.03;
          } else if (newY > bottomBorder) {
            // Bottom border collision
            newY = bottomBorder - (newY - bottomBorder) * bounceFactor; // Reflect position
            velocityY = -Math.abs(velocityY) * bounceFactor; // Reverse and dampen velocity
            
            // Add slight horizontal randomization on bounce for natural effect
            velocityX += (Math.random() - 0.5) * 0.03;
            
            // Ensure flakes don't get stuck at the bottom
            if (Math.abs(velocityY) < 0.02) {
              velocityY = -0.05 - Math.random() * 0.1; // Add upward boost if moving too slowly
            }
          }
          
          return {
            ...flake,
            x: newX,
            y: newY,
            velocityX,
            velocityY
          };
        });
        
        // Second pass: handle flake-to-flake collisions
        return updatedFlakes.map((flake, index) => {
          let { x, y, velocityX, velocityY, size } = flake;
          
          // Only check nearby flakes for collision (performance optimization)
          for (let i = 0; i < updatedFlakes.length; i++) {
            // Skip self
            if (i === index) continue;
            
            const otherFlake = updatedFlakes[i];
            
            // Calculate distance between flakes
            const dx = otherFlake.x - x;
            const dy = otherFlake.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Combined radius for collision detection (in percentage space)
            const combinedRadius = (size + otherFlake.size) / 200; // Convert to percentage-based units
            
            // Check for collision
            if (distance < combinedRadius) {
              // Collision detected!
              // Calculate collision response based on relative mass
              const angle = Math.atan2(dy, dx);
              
              // Calculate mass based on size (area)
              const massFactor = otherFlake.size / (size + otherFlake.size);
              
              // Elastic collision response - transfer momentum
              // Stronger effect for smaller flakes colliding with larger ones
              const collisionStrength = 0.03 * (1 - (distance / combinedRadius));
              
              // Push flakes away from each other
              velocityX -= Math.cos(angle) * collisionStrength * massFactor;
              velocityY -= Math.sin(angle) * collisionStrength * massFactor;
              
              // Transfer some momentum to simulate physical impact
              const otherVelocityX = otherFlake.velocityX;
              const otherVelocityY = otherFlake.velocityY;
              
              // Momentum transfer (partial)
              velocityX += otherVelocityX * 0.05 * massFactor;
              velocityY += otherVelocityY * 0.05 * massFactor;
            }
          }
          
          return {
            ...flake,
            velocityX,
            velocityY
          };
        });
      });
      
      animationFrameId.current = requestAnimationFrame(animateSnowflakes);
    };
    
    animateSnowflakes();
    
    // Cleanup
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []); // Empty dependency array to prevent re-initialization

  const handleReveal = () => {
    setStage("loading");
    // Simulate loading for dramatic effect
    setTimeout(() => {
      setStage("answer");
    }, 3000);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center p-4 overflow-hidden" ref={containerRef}>
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/skiingwp2.jpg"
          alt="Skiing background"
          fill
          priority
          className="object-cover brightness-[0.85] filter"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/40 via-indigo-500/30 to-sky-400/40 bg-gradient-animate mix-blend-multiply"></div>
        <div className="absolute inset-0 backdrop-blur-[2px]"></div>
      </div>
      
      {/* Interactive Snowflakes */}
      <div className="snowfall-container">
        {snowflakes.map(flake => (
          <div
            key={flake.id}
            className="interactive-snowflake"
            style={{
              left: `${flake.x}%`,
              top: `${flake.y}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
              zIndex: Math.floor(flake.size),
              transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
          />
        ))}
      </div>
      
      <main className="z-10 flex w-full max-w-3xl flex-col items-center justify-center gap-10 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl text-white drop-shadow-lg">
          Should I Go <span className="text-white/90">Skiing?</span>
        </h1>
        
        {stage === "question" && (
          <div className="w-full transform transition-all duration-500 hover:scale-[1.02]">
            <Card className="w-full overflow-hidden bg-white/80 backdrop-blur border-none shadow-xl rounded-2xl">
              <CardContent className="flex flex-col items-center gap-8 p-10">
                <p className="text-xl text-gray-700">
                  Wondering if today's the perfect day to hit the slopes?
                </p>
                <Button 
                  size="lg" 
                  onClick={handleReveal}
                  className="bg-blue-600 hover:bg-blue-700 text-lg font-semibold py-6 px-10 rounded-full shadow-lg transform transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl pulse-shadow"
                >
                  Let's Find Out
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {stage === "loading" && (
          <div className="w-full">
            <Card className="w-full bg-white/90 backdrop-blur border-none shadow-xl rounded-2xl">
              <CardContent className="flex flex-col items-center p-14">
                <div className="snowflake-container relative h-60 w-60">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-6 w-6 rounded-full bg-blue-500 animate-snowflake"
                      style={{
                        left: `${Math.sin((i / 12) * Math.PI * 2) * 80 + 80}px`,
                        top: `${Math.cos((i / 12) * Math.PI * 2) * 80 + 80}px`,
                        animationDelay: `${i * 100}ms`,
                        opacity: 0.8,
                        boxShadow: '0 0 12px rgba(37, 99, 235, 0.8)'
                      }}
                    />
                  ))}
                </div>
                <p className="mt-10 text-xl font-medium text-gray-700">
                 Trying to be reasonable about life priorities...
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {stage === "answer" && (
          <div className="w-full transform transition-all duration-700 hover:scale-[1.02]">
            <Card className="w-full border-none rounded-2xl bg-gradient-to-r from-blue-600/90 to-indigo-600/90 shadow-2xl overflow-hidden bg-gradient-animate">
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
              <CardContent className="flex flex-col items-center gap-6 p-10 relative z-10">
                <div className="bg-white/30 rounded-full p-6 backdrop-blur-sm shadow-inner pulse-shadow">
                  <h2 className="text-6xl font-extrabold text-white animate-bounce">
                    YES!
                  </h2>
                </div>
                <p className="text-2xl font-medium text-white/90 mt-4">
                  You should absolutely go skiing today!
                </p>
                <div className="mt-8 flex gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStage("question")}
                    className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 rounded-full px-6"
                  >
                    Ask Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      
      <footer className="z-10 mt-10 text-white text-sm font-medium">
        ❄️ Fun guaranteed
      </footer>
    </div>
  );
}
