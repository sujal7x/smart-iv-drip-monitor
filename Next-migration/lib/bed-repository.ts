import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { getDb } from "./firebase";
import { Bed } from "./types";

const collectionName = "beds";

export async function loadBeds(): Promise<Bed[] | null> {
  const db = getDb();
  if (!db) return null;
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((item) => item.data() as Bed);
}

export async function saveBed(bed: Bed): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  await setDoc(doc(db, collectionName, bed.id), bed);
  return true;
}
