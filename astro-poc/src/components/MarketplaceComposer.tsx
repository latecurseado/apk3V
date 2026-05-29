import { useState } from 'preact/hooks';
import { createItem, CATEGORY_LABELS, type ItemCategory, type ItemCondition } from '../lib/marketplace';
import { uploadAttachment } from '../lib/attachments';
import { toast } from '../lib/toast';

interface Props {
    onClose: () => void;
    onPosted?: () => void;
}

export default function MarketplaceComposer({ onClose, onPosted }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState<ItemCategory>('otros');
    const [condition, setCondition] = useState<ItemCondition>('usado');
    const [location, setLocation] = useState('Tres Valles, Veracruz');
    const [phone, setPhone] = useState('');
    const [images, setImages] = useState<{ url: string; name?: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState(false);

    const handleImages = async (e: any) => {
        const files = Array.from(e.target.files || []) as File[];
        if (!files.length) return;
        if (images.length + files.length > 6) {
            toast.error('Máximo 6 fotos');
            return;
        }
        setUploading(true);
        for (const f of files) {
            const res = await uploadAttachment(f);
            if (res.ok && res.attachment) {
                setImages(prev => [...prev, { url: res.attachment!.url, name: res.attachment!.name }]);
            } else {
                toast.error(`${f.name}: ${res.reason}`);
            }
        }
        setUploading(false);
        e.target.value = '';
    };

    const submit = async () => {
        if (title.trim().length < 3) { toast.error('Título muy corto'); return; }
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) { toast.error('Precio inválido'); return; }
        setBusy(true);
        const id = await createItem({
            title: title.trim(),
            description: description.trim(),
            price: priceNum,
            category,
            condition,
            location: location.trim(),
            images,
            contact_phone: phone.trim(),
        });
        setBusy(false);
        if (!id) { toast.error('No se pudo publicar'); return; }
        toast.success('¡Artículo publicado!');
        onPosted?.();
    };

    return (
        <div class="modal-overlay" onClick={onClose}>
            <div class="modal marketplace-composer" onClick={(e: any) => e.stopPropagation()}>
                <header class="modal-head">
                    <h3><i class="fas fa-store"></i> Publicar artículo</h3>
                    <button class="modal-close" onClick={onClose}><i class="fas fa-xmark"></i></button>
                </header>
                <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
                    <label class="reel-caption">
                        <span><i class="fas fa-tag"></i> Título</span>
                        <input type="text" maxLength={80} placeholder="ej. Bicicleta montañera rodada 26"
                            value={title} onInput={(e: any) => setTitle(e.currentTarget.value)} />
                    </label>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <label class="reel-caption">
                            <span><i class="fas fa-dollar-sign"></i> Precio (MXN)</span>
                            <input type="number" inputMode="decimal" min="0" step="50" placeholder="1500"
                                value={price} onInput={(e: any) => setPrice(e.currentTarget.value)} />
                        </label>
                        <label class="reel-caption">
                            <span><i class="fas fa-tags"></i> Estado</span>
                            <select value={condition} onChange={(e: any) => setCondition(e.currentTarget.value)}>
                                <option value="nuevo">Nuevo</option>
                                <option value="seminuevo">Seminuevo</option>
                                <option value="usado">Usado</option>
                            </select>
                        </label>
                    </div>

                    <label class="reel-caption">
                        <span><i class="fas fa-folder"></i> Categoría</span>
                        <select value={category} onChange={(e: any) => setCategory(e.currentTarget.value)}>
                            {(Object.entries(CATEGORY_LABELS) as Array<[ItemCategory, any]>).map(([k, info]) => (
                                <option value={k}>{info.label}</option>
                            ))}
                        </select>
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-align-left"></i> Descripción</span>
                        <textarea rows={4} maxLength={1500} placeholder="Cuéntales detalles, marca, kilometraje, etc."
                            value={description} onInput={(e: any) => setDescription(e.currentTarget.value)} />
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-location-dot"></i> Ubicación</span>
                        <input type="text" maxLength={80} value={location}
                            onInput={(e: any) => setLocation(e.currentTarget.value)} />
                    </label>

                    <label class="reel-caption">
                        <span><i class="fas fa-phone"></i> WhatsApp (opcional)</span>
                        <input type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="+52 …"
                            value={phone} onInput={(e: any) => setPhone(e.currentTarget.value)} />
                        <small class="auth-hint">Si lo dejas vacío, te contactarán por DM</small>
                    </label>

                    <div class="market-img-row">
                        <label class={`compose-tool ${uploading ? 'busy' : ''}`} style="padding:8px 14px;">
                            <i class={`fas ${uploading ? 'fa-circle-notch fa-spin' : 'fa-images'}`}></i>
                            <span>Añadir fotos ({images.length}/6)</span>
                            <input type="file" accept="image/*" multiple onChange={handleImages}
                                disabled={uploading || images.length >= 6} style="display:none;" />
                        </label>
                        <div class="market-img-thumbs">
                            {images.map((img, i) => (
                                <div class="attach-preview" key={img.url}>
                                    <img src={img.url} alt="" />
                                    <button class="attach-x" onClick={() => setImages(arr => arr.filter((_, j) => j !== i))}>
                                        <i class="fas fa-xmark"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <footer class="compose-footer">
                    <button class="auth-btn ghost small" onClick={onClose} disabled={busy}>Cancelar</button>
                    <button class="auth-btn primary" onClick={submit} disabled={busy || !title.trim() || !price}>
                        {busy
                            ? <><i class="fas fa-circle-notch fa-spin"></i> Publicando…</>
                            : <><i class="fas fa-paper-plane"></i> Publicar</>}
                    </button>
                </footer>
            </div>
        </div>
    );
}
