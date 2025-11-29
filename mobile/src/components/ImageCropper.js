import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function ImageCropper({
  file,
  onCrop,
  onCancel,
  aspectRatio = 1,
}) {
  const { colors } = useTheme();
  const canvasRef = useRef(null);
  const [imageData, setImageData] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, size: 200 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !file) return;

    const img = new Image();
    img.onload = () => {
      const maxDisplaySize = 300;
      const scale = Math.min(
        maxDisplaySize / img.width,
        maxDisplaySize / img.height,
        1,
      );
      const displayWidth = img.width * scale;
      const displayHeight = img.height * scale;

      const initialSize = Math.min(displayWidth, displayHeight) * 0.8;
      const initialX = (displayWidth - initialSize) / 2;
      const initialY = (displayHeight - initialSize) / 2;

      setImageData({
        img,
        displayWidth,
        displayHeight,
        naturalWidth: img.width,
        naturalHeight: img.height,
        scale,
      });
      setCropArea({ x: initialX, y: initialY, size: initialSize });
    };

    if (file instanceof File) {
      img.src = URL.createObjectURL(file);
    } else if (file.uri) {
      img.src = file.uri;
    }

    return () => {
      if (img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
    };
  }, [file]);

  useEffect(() => {
    if (!canvasRef.current || !imageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = imageData.displayWidth;
    canvas.height = imageData.displayHeight;

    // Draw image
    ctx.drawImage(
      imageData.img,
      0,
      0,
      imageData.displayWidth,
      imageData.displayHeight,
    );

    // Draw dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clear crop area
    ctx.clearRect(cropArea.x, cropArea.y, cropArea.size, cropArea.size);
    ctx.drawImage(
      imageData.img,
      cropArea.x / imageData.scale,
      cropArea.y / imageData.scale,
      cropArea.size / imageData.scale,
      cropArea.size / imageData.scale,
      cropArea.x,
      cropArea.y,
      cropArea.size,
      cropArea.size,
    );

    // Draw crop border
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.size, cropArea.size);

    // Draw corner handles
    const handleSize = 12;
    ctx.fillStyle = colors.accent;
    // Bottom-right corner (resize handle)
    ctx.fillRect(
      cropArea.x + cropArea.size - handleSize / 2,
      cropArea.y + cropArea.size - handleSize / 2,
      handleSize,
      handleSize,
    );
  }, [imageData, cropArea, colors]);

  const handleMouseDown = (e) => {
    if (!imageData) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking resize handle
    const handleSize = 16;
    const handleX = cropArea.x + cropArea.size;
    const handleY = cropArea.y + cropArea.size;

    if (
      Math.abs(x - handleX) < handleSize &&
      Math.abs(y - handleY) < handleSize
    ) {
      setResizing(true);
      setStartPos({ x, y, initialSize: cropArea.size });
    } else if (
      x >= cropArea.x &&
      x <= cropArea.x + cropArea.size &&
      y >= cropArea.y &&
      y <= cropArea.y + cropArea.size
    ) {
      setDragging(true);
      setStartPos({ x: x - cropArea.x, y: y - cropArea.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!imageData || (!dragging && !resizing)) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (resizing) {
      const diff = Math.max(
        x - (cropArea.x + startPos.initialSize),
        y - (cropArea.y + startPos.initialSize),
      );
      const newSize = Math.max(
        50,
        Math.min(
          startPos.initialSize + diff,
          imageData.displayWidth - cropArea.x,
          imageData.displayHeight - cropArea.y,
        ),
      );
      setCropArea((prev) => ({ ...prev, size: newSize }));
    } else if (dragging) {
      const newX = Math.max(
        0,
        Math.min(x - startPos.x, imageData.displayWidth - cropArea.size),
      );
      const newY = Math.max(
        0,
        Math.min(y - startPos.y, imageData.displayHeight - cropArea.size),
      );
      setCropArea((prev) => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setResizing(false);
  };

  const handleCrop = async () => {
    if (!imageData) return;

    const outputCanvas = document.createElement("canvas");
    const outputSize = 512; // Output size for avatar/icon
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;

    const ctx = outputCanvas.getContext("2d");

    // Calculate source coordinates in original image
    const sourceX = cropArea.x / imageData.scale;
    const sourceY = cropArea.y / imageData.scale;
    const sourceSize = cropArea.size / imageData.scale;

    ctx.drawImage(
      imageData.img,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize,
    );

    outputCanvas.toBlob(
      (blob) => {
        const croppedFile = new File([blob], "cropped.jpg", {
          type: "image/jpeg",
        });
        onCrop(croppedFile);
      },
      "image/jpeg",
      0.9,
    );
  };

  if (Platform.OS !== "web") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Crop Image</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Drag to move, drag corner to resize
        </Text>

        <div
          ref={containerRef}
          style={{
            position: "relative",
            cursor: dragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
        </div>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.cancelBtn,
              { borderColor: colors.glassBorder },
            ]}
            onPress={onCancel}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.accent }]}
            onPress={handleCrop}
          >
            <Text style={[styles.buttonText, { color: "#000" }]}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    maxWidth: 400,
    width: "90%",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
