'use client';

import React, { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Camera, X } from 'lucide-react';
import { Avatar } from './Avatar';
import { useToast } from './ToastProvider';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — matches the server-side cap
const OUTPUT_SIZE = 512; // square, downscaled here regardless of source size

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedJpegBlob(imageSrc: string, cropPixels: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, OUTPUT_SIZE, OUTPUT_SIZE
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the cropped image.'))),
      'image/jpeg',
      0.85
    );
  });
}

interface AvatarUploadProps {
  currentSrc?: string | null;
  name: string;
  size?: number;
  onUploaded: (avatarUrl: string) => void;
}

// Wraps <Avatar> with a hover-to-change affordance and the crop-then-upload
// modal. Downscaling + re-encoding to JPEG happens entirely client-side
// (via canvas) before the request ever goes out, so the upload is small
// regardless of the source photo's original size — the 2MB cap on top of
// that is a server-side safety net, not the primary size control.
export function AvatarUpload({ currentSrc, name, size = 64, onUploaded }: AvatarUploadProps) {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be re-selected later if canceled
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      showError('That image is over 2MB — please choose a smaller one.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const closeModal = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const blob = await getCroppedJpegBlob(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append('avatar', blob, 'avatar.jpg');

      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      showSuccess('Profile photo updated.');
      onUploaded(data.avatarUrl);
      closeModal();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative group shrink-0" style={{ width: size, height: size }}>
        <Avatar src={currentSrc} name={name} size={size} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-neutral-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          title="Change profile photo"
        >
          <Camera size={Math.round(size * 0.35)} className="text-neutral-200" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {imageSrc && (
        <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-100">Update profile photo</h3>
              <button onClick={closeModal} className="text-neutral-500 hover:text-neutral-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="relative w-full h-72 bg-neutral-950 rounded-xl overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-wider">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={closeModal}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-neutral-400 hover:text-neutral-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !croppedAreaPixels}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-brand-500 text-neutral-950 hover:bg-brand-400 disabled:bg-neutral-800 disabled:text-neutral-500 transition-all active:scale-95"
              >
                {uploading ? 'Saving…' : 'Save Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
