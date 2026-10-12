import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";

/**
 * Pengganti `useActionState` + `<form action>` yang TIDAK mengosongkan isian
 * saat server mengembalikan error. (React 19 otomatis me-reset form setelah
 * setiap action, sehingga teks & file yang sudah diisi pengguna ikut hilang.)
 * Form hanya di-reset bila hasil action bernilai `ok: true`.
 *
 * Pemakaian:
 *   const [state, formProps, pending] = useFormAction(action, initialState);
 *   <form {...formProps}>…</form>
 */
export function useFormAction<S extends { error?: string; ok?: boolean }>(
  action: (prevState: S, formData: FormData) => Promise<S>,
  initialState: S,
) {
  // useActionState mengetik state sebagai Awaited<S>; untuk S berupa objek
  // biasa nilainya identik dengan S, jadi aman di-cast.
  const [awaitedState, dispatch, pending] = useActionState<S, FormData>(
    action as (prevState: Awaited<S>, formData: FormData) => Promise<S>,
    initialState as Awaited<S>,
  );
  const state = awaitedState as S;
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Sertakan tombol submit yang diklik (mis. name="_action" Setujui/Tolak).
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return [state, { ref, onSubmit }, pending] as const;
}
