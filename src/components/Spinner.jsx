import React from "react";

export default function Spinner({ label, fullPage = false }) {
  const content = (
    <div className="spinner-wrap">
      <div className="spinner-ring">
        <div />
        <div />
        <div />
      </div>
      {label && <div className="spinner-label">{label}</div>}
    </div>
  );
  if (fullPage) return <div className="spinner-fullpage">{content}</div>;
  return content;
}
