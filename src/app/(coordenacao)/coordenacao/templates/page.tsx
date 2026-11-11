import { redirect } from "next/navigation";

/** Compatibilidade para favoritos antigos: o Kit não possui gestão administrativa. */
export default function Page() {
  redirect("/documentos");
}
