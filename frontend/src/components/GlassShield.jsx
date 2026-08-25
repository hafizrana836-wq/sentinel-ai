import { useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";

export default function GlassShield() {
    const containerRef = useRef(null);

    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const rotateX = useSpring(useTransform(mouseY, [-100, 100], [12, -12]), {
        stiffness: 80,
        damping: 15
    });
    const rotateY = useSpring(useTransform(mouseX, [-100, 100], [-12, 12]), {
        stiffness: 80,
        damping: 15
    });

    function handleMouseMove(e) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        mouseX.set(e.clientX - centerX);
        mouseY.set(e.clientY - centerY);
    }

    function handleMouseLeave() {
        mouseX.set(0);
        mouseY.set(0);
    }

    return (
        <div
            className="glass-shield-perspective"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* Outer wrapper: continuous slow rotation (CSS animation) */}
            <div className="glass-shield-spin">
                {/* Inner wrapper: mouse parallax tilt (Framer Motion) */}
                <motion.div
                    className="glass-shield-tilt"
                    style={{ rotateX, rotateY }}
                >
                    <div className="glass-shield-glow" />

                    <svg
                        className="glass-shield-svg"
                        viewBox="0 0 200 220"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <linearGradient id="shieldGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                                <stop offset="45%" stopColor="#93c5fd" stopOpacity="0.35" />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.45" />
                            </linearGradient>
                            <linearGradient id="shieldEdge" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.6" />
                            </linearGradient>
                        </defs>

                        {/* Shield outline */}
                        <path
                            d="M100 10 L180 40 V110 C180 155 145 190 100 210 C55 190 20 155 20 110 V40 Z"
                            fill="url(#shieldGlass)"
                            stroke="url(#shieldEdge)"
                            strokeWidth="2.5"
                        />

                        {/* Facet lines (crystal effect) */}
                        <path d="M100 10 V210" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
                        <path d="M20 60 L180 60" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <path d="M30 130 L170 130" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <path d="M100 10 L40 90" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                        <path d="M100 10 L160 90" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

                        {/* Inner checkmark (security confirmation) */}
                        <path
                            d="M70 110 L92 132 L132 88"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.9"
                        />
                    </svg>
                </motion.div>
            </div>
        </div>
    );
}
