import React from "react";

interface SectionWrapperProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

const SectionWrapper = ({ number, title, children }: SectionWrapperProps) => (
  <div className="section-card">
    <div className="section-header">
      <span className="section-number">{number}</span>
      <h2 className="section-title">{title}</h2>
    </div>
    <div className="p-6 space-y-5">{children}</div>
  </div>
);

export default SectionWrapper;
