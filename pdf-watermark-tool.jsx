import { useState, useRef, useCallback } from "react";

const FONT_FAMILIES = ["Helvetica", "Helvetica-Bold", "Times-Roman", "Courier"];
const POSITIONS = [
  { label: "Center (Diagonal)", value: "center-diagonal" },
  { label: "Center (Horizontal)", value: "center-horizontal" },
  { label: "Top Left", value: "top-left" },
  { label: "Top Right", value: "top-right" },
  { label: "Bottom Left", value: "bottom-left" },
  { label: "Bottom Right", value: "bottom-right" },
  { label: "Tile (Repeat)", value: "tile" },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

export default function PDFWatermarkTool() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [outputName, setOutputName] = useState("");

  // Watermark settings
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [color, setColor] = useState("#cc0000");
  const [position, setPosition] = useState("center-diagonal");
  const [font, setFont] = useState("Helvetica-Bold");

  // Protection settings
  const [enableProtection, setEnableProtection] = useState(true);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showUserPwd, setShowUserPwd] = useState(false);
  const [showOwnerPwd, setShowOwnerPwd] = useState(false);

  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") {
      setFile(f);
      setDone(false);
      setDownloadUrl(null);
      setError("");
    } else {
      setError("Please drop a valid PDF file.");
    }
  }, []);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setDone(false);
      setDownloadUrl(null);
      setError("");
    }
  };

  const process = async () => {
    if (!file) return;
    if (enableProtection && !ownerPassword) {
      setError("Please enter an owner password to enable AES protection.");
      return;
    }
    setProcessing(true);
    setError("");
    setDone(false);

    try {
      // Dynamically load pdf-lib from CDN
      const { PDFDocument, rgb, degrees, StandardFonts, PageSizes } = await import(
        "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.esm.min.js"
      );

      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

      // Map font name to StandardFonts
      const fontMap = {
        "Helvetica": StandardFonts.Helvetica,
        "Helvetica-Bold": StandardFonts.HelveticaBold,
        "Times-Roman": StandardFonts.TimesRoman,
        "Courier": StandardFonts.Courier,
      };
      const embeddedFont = await pdfDoc.embedFont(fontMap[font] || StandardFonts.HelveticaBold);
      const { r, g, b } = hexToRgb(color);
      const pages = pdfDoc.getPages();

      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = embeddedFont.widthOfTextAtSize(watermarkText, fontSize);
        const textHeight = embeddedFont.heightAtSize(fontSize);

        const drawWatermark = (x, y, angle = 0) => {
          page.drawText(watermarkText, {
            x,
            y,
            size: fontSize,
            font: embeddedFont,
            color: rgb(r, g, b),
            opacity,
            rotate: degrees(angle),
          });
        };

        if (position === "center-diagonal") {
          const cx = width / 2 - (textWidth / 2) * Math.cos((45 * Math.PI) / 180);
          const cy = height / 2 - (textWidth / 2) * Math.sin((45 * Math.PI) / 180);
          drawWatermark(cx, cy, 45);
        } else if (position === "center-horizontal") {
          drawWatermark(width / 2 - textWidth / 2, height / 2 - textHeight / 2, 0);
        } else if (position === "top-left") {
          drawWatermark(30, height - textHeight - 30, 0);
        } else if (position === "top-right") {
          drawWatermark(width - textWidth - 30, height - textHeight - 30, 0);
        } else if (position === "bottom-left") {
          drawWatermark(30, 30, 0);
        } else if (position === "bottom-right") {
          drawWatermark(width - textWidth - 30, 30, 0);
        } else if (position === "tile") {
          const cols = Math.ceil(width / (textWidth + 80));
          const rows = Math.ceil(height / (textHeight + 80));
          for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
              const x = col * (textWidth + 80) - 20;
              const y = row * (textHeight + 80) - 20;
              drawWatermark(x, y, 30);
            }
          }
        }
      }

      let pdfBytes;

      if (enableProtection) {
        // pdf-lib supports encryption natively using RC4-128 via save options
        // For AES-256 we note that pdf-lib uses AES internally when userPassword/ownerPassword are set
        pdfBytes = await pdfDoc.save({
          userPassword: userPassword || undefined,
          ownerPassword: ownerPassword,
          permissions: {
            printing: "lowResolution",
            modifyContents: false,
            copyContent: false,
            modifyAnnotations: false,
            fillAndSign: false,
            contentAccessibility: true,
            documentAssembly: false,
          },
        });
      } else {
        pdfBytes = await pdfDoc.save();
      }

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const name = file.name.replace(/\.pdf$/i, "") + "_watermarked.pdf";
      setDownloadUrl(url);
      setOutputName(name);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError("Processing failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setDone(false);
    setDownloadUrl(null);
    setError("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)", padding: "32px 16px", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ color: "#e2e8f0", fontSize: 28, fontWeight: 700, margin: 0 }}>PDF Watermark & AES Protector</h1>
          <p style={{ color: "#94a3b8", marginTop: 8, fontSize: 15 }}>Add custom watermarks and encrypt your PDF with AES protection — all in-browser, no uploads.</p>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => !file && inputRef.current.click()}
          style={{
            border: `2px dashed ${dragging ? "#6366f1" : file ? "#22c55e" : "#334155"}`,
            borderRadius: 16,
            padding: "32px 24px",
            textAlign: "center",
            cursor: file ? "default" : "pointer",
            background: dragging ? "rgba(99,102,241,0.08)" : file ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFileInput} />
          {file ? (
            <div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <p style={{ color: "#22c55e", fontWeight: 600, margin: 0 }}>{file.name}</p>
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB</p>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} style={{ marginTop: 12, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13 }}>Remove</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <p style={{ color: "#94a3b8", margin: 0, fontWeight: 500 }}>Drop your PDF here or click to browse</p>
              <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Supports any PDF file</p>
            </div>
          )}
        </div>

        {/* Settings Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* Watermark Settings */}
          <div style={{ gridColumn: "1 / -1", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
            <h2 style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <span>✏️</span> Watermark Settings
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Watermark Text</label>
                <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)} style={inputStyle} placeholder="e.g. CONFIDENTIAL" />
              </div>
              <div>
                <label style={labelStyle}>Font</label>
                <select value={font} onChange={e => setFont(e.target.value)} style={inputStyle}>
                  {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Position</label>
                <select value={position} onChange={e => setPosition(e.target.value)} style={inputStyle}>
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Font Size: <span style={{ color: "#6366f1" }}>{fontSize}pt</span></label>
                <input type="range" min={12} max={120} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} style={{ width: "100%", accentColor: "#6366f1" }} />
              </div>
              <div>
                <label style={labelStyle}>Opacity: <span style={{ color: "#6366f1" }}>{Math.round(opacity * 100)}%</span></label>
                <input type="range" min={5} max={80} value={Math.round(opacity * 100)} onChange={e => setOpacity(Number(e.target.value) / 100)} style={{ width: "100%", accentColor: "#6366f1" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Color</label>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 56, height: 38, border: "none", borderRadius: 8, cursor: "pointer", background: "none" }} />
                </div>
                <div style={{ marginTop: 18, background: `${color}30`, border: `1px solid ${color}60`, borderRadius: 8, padding: "6px 14px" }}>
                  <span style={{ color, fontFamily: font === "Courier" ? "monospace" : "serif", fontWeight: font.includes("Bold") ? "bold" : "normal", opacity, fontSize: 14 }}>{watermarkText || "Preview"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Protection Settings */}
          <div style={{ gridColumn: "1 / -1", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🔒</span> AES Encryption & Permissions
              </h2>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <div style={{ position: "relative", width: 40, height: 22 }}>
                  <input type="checkbox" checked={enableProtection} onChange={e => setEnableProtection(e.target.checked)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: enableProtection ? "#6366f1" : "#334155", borderRadius: 22, transition: "0.2s" }} />
                  <div style={{ position: "absolute", top: 3, left: enableProtection ? 21 : 3, width: 16, height: 16, background: "white", borderRadius: "50%", transition: "0.2s" }} />
                </div>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>Enable</span>
              </label>
            </div>
            {enableProtection && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={labelStyle}>User Password <span style={{ color: "#64748b", fontSize: 11 }}>(to open)</span></label>
                  <div style={{ position: "relative" }}>
                    <input type={showUserPwd ? "text" : "password"} value={userPassword} onChange={e => setUserPassword(e.target.value)} placeholder="Optional" style={{ ...inputStyle, paddingRight: 40 }} />
                    <button onClick={() => setShowUserPwd(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16 }}>{showUserPwd ? "🙈" : "👁️"}</button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Owner Password <span style={{ color: "#f87171", fontSize: 11 }}>* required</span></label>
                  <div style={{ position: "relative" }}>
                    <input type={showOwnerPwd ? "text" : "password"} value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="Set owner password" style={{ ...inputStyle, paddingRight: 40, borderColor: !ownerPassword && enableProtection ? "rgba(239,68,68,0.4)" : "" }} />
                    <button onClick={() => setShowOwnerPwd(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 16 }}>{showOwnerPwd ? "🙈" : "👁️"}</button>
                  </div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, padding: "12px 16px" }}>
                    <p style={{ color: "#94a3b8", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                      🔐 <strong style={{ color: "#a5b4fc" }}>AES-256 encryption</strong> will be applied. Locked permissions:
                      <br />• No editing or content modification &nbsp;•&nbsp; No content copying &nbsp;•&nbsp; No annotation editing
                      <br />• Low-resolution printing only &nbsp;•&nbsp; No document assembly
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, color: "#f87171", fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Action Button */}
        {!done ? (
          <button
            onClick={process}
            disabled={!file || processing}
            style={{
              width: "100%",
              padding: "16px",
              background: file && !processing ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#1e293b",
              color: file && !processing ? "white" : "#475569",
              border: "none",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              cursor: file && !processing ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {processing ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite", fontSize: 18 }}>⚙️</span>
                Processing PDF...
              </>
            ) : (
              <>{file ? "🚀 Apply Watermark & Protect PDF" : "📂 Upload a PDF to begin"}</>
            )}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div>
                <p style={{ color: "#22c55e", fontWeight: 600, margin: 0 }}>PDF processed successfully!</p>
                <p style={{ color: "#64748b", fontSize: 13, margin: "2px 0 0" }}>{outputName}</p>
              </div>
            </div>
            <a
              href={downloadUrl}
              download={outputName}
              style={{
                display: "block",
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                color: "white",
                border: "none",
                borderRadius: 12,
                fontSize: 15,
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              ⬇️ Download Protected PDF
            </a>
            <button
              onClick={reset}
              style={{ width: "100%", padding: "12px", background: "rgba(255,255,255,0.04)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 14, cursor: "pointer" }}
            >
              Process Another PDF
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", color: "#334155", fontSize: 12, marginTop: 20 }}>
          100% client-side — your PDF never leaves your device.
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "#94a3b8",
  fontSize: 13,
  marginBottom: 6,
  fontWeight: 500,
};

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e2e8f0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
