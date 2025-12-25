'use client';

import React from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';

const navItems = [
  { label: 'Install', href: '#install' },
  { label: 'Features', href: '#features' },
  { label: 'Quickstart', href: '#quickstart' },
];

const externalLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/audgeviolin07/asillios-limiter',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    label: 'npm',
    href: 'https://www.npmjs.com/package/asillios-limiter',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z"/>
      </svg>
    ),
  },
];

export default function Sidebar() {
  const [activeSection, setActiveSection] = React.useState('');

  React.useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => item.href.slice(1));
      const scrollPosition = window.scrollY + 100;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          return;
        }
      }
      setActiveSection('');
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.getElementById(href.slice(1));
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-screen w-56 bg-neutral-950 border-r border-neutral-800 z-50 hidden lg:flex flex-col"
    >
      {/* Logo */}
      <div className="p-6 border-b border-neutral-800">
        <a href="/" className="flex items-center gap-3">
          <Image
            src="/greek.png"
            alt="Asillios"
            width={32}
            height={32}
            className="opacity-80"
          />
          <span className="text-white font-medium text-lg">Asillios</span>
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeSection === item.href.slice(1);
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="relative block"
              >
                <motion.div
                  className={`px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'text-white bg-teal-900/50'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                  }`}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.2 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-teal-500 rounded-full"
                    />
                  )}
                  {item.label}
                </motion.div>
              </a>
            );
          })}
        </div>
      </nav>

      {/* External Links */}
      <div className="p-4 border-t border-neutral-800">
        <div className="space-y-1">
          {externalLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-lg transition-colors"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-neutral-800">
        <p className="text-xs text-neutral-600 text-center">
          Open Source
        </p>
      </div>
    </motion.aside>
  );
}
