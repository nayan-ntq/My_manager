import React from "react";

export default function Spinner({ label, fullPage = false }) {
  const content = (
    <div className="spinner-wrap">
      <div className="logo-spinner">
        <div className="logo-spinner-ring" />
        <img src="/icon-192.png" alt="" className="logo-spinner-img" />
      </div>
      {label && <div className="spinner-label">{label}</div>}
    </div>
  );
  if (fullPage) return <div className="spinner-fullpage">{content}</div>;
  return content;
}
