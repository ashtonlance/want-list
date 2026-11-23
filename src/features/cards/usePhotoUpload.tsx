import { useCallback, useRef } from "react";
import { UploadError, uploadPhoto } from "~/data/docs";
import { useToast } from "~/ui/Toast";
import { useCardWrites } from "./api";
import type { Card } from "./types";

const UPLOAD_ERRORS: Record<UploadError["code"], string> = {
  too_large: "That photo is over 20 MB. Try a smaller one.",
  unsupported_type: "Use a JPEG, PNG, WebP or GIF photo.",
  failed: "Couldn't upload the photo. Try again.",
};

/** A hidden file input that uploads a photo of a card and saves it on the card. */
export function usePhotoUpload(card: Card) {
  const input = useRef<HTMLInputElement>(null);
  const { save } = useCardWrites();
  const { toast, toastBusy } = useToast();

  const pick = useCallback(() => {
    if (!input.current) return;
    input.current.value = "";
    input.current.click();
  }, []);

  const onChange = async (file: File | undefined) => {
    if (!file) return;
    // Stays up until the upload finishes, however long a big photo takes.
    toastBusy("Uploading photo…");
    try {
      const url = await uploadPhoto(file);
      // save() always replaces the busy message: "Photo added" or why it didn't save.
      await save(card, { img: url, imgSource: "upload" }, "Photo added");
    } catch (e) {
      toast(UPLOAD_ERRORS[e instanceof UploadError ? e.code : "failed"]);
    }
  };

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      hidden
      onChange={(e) => void onChange(e.target.files?.[0])}
    />
  );
  return { pick, fileInput };
}
