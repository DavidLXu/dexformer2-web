"""Export the joint 43-combination t-SNE without refitting or changing coordinates."""
import argparse, collections, hashlib, json
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser();p.add_argument('source',type=Path);args=p.parse_args()
root=Path(__file__).resolve().parents[1];source=args.source
original=json.loads((root/'data.js').read_text().removeprefix('window.TSNE_DATA = ').strip().removesuffix(';'))
meta=json.loads((source/'analysis/samples.json').read_text())
xy=np.load(source/'analysis/embedding.npz')['tsne2']
report=json.loads((source/'analysis/report.json').read_text())
style=json.loads((source/'figures/plot_validation.json').read_text())
assert report['points']==34400 and xy.shape==(34400,2)
assert np.isfinite(xy).all()
counts=collections.Counter(row['composition'] for row in meta)
assert len(counts)==43 and set(counts.values())=={800}
by_name={row['composition']:row for row in meta}
groups=[dict(g,layer='original') for g in original['groups']]
arm_names={'flexiv':'Flexiv','franka':'Franka','kuka':'KUKA','xarm':'xArm7','ur5e':'UR5e'}
hand_names={'wuji':'Wuji 1','wuji2':'Wuji 2.2','tesollo':'Tesollo','leap':'LEAP','allegro':'Allegro','rapid':'RAPID','revo3':'Revo3','shadow':'Shadow','sharpa':'Sharpa'}
new=sorted((c for c in counts if c not in {g['composition'] for g in groups}),key=lambda c:(list(arm_names).index(by_name[c]['arm']),list(hand_names).index(by_name[c]['hand'])))
for c in new:
 r=by_name[c];groups.append(dict(composition=c,arm=r['arm'],arm_display=arm_names[r['arm']],hand=r['hand'],hand_display=hand_names[r['hand']],seen_unseen='unseen',category=r['category'],layer='new-arm' if r['arm']=='ur5e' else 'new-hands',color_hex=style['colors'][c],count=counts[c]))
index={g['composition']:i for i,g in enumerate(groups)}
order=np.random.default_rng(42).permutation(len(xy))
points=[[round(float(xy[i,0]),4),round(float(xy[i,1]),4),index[meta[i]['composition']]] for i in order]
for g in groups[:24]:assert g['color_hex']==by_name[g['composition']]['color_hex']
out=dict(groups=groups,points=points,extent=180,metadata=dict(combinations=43,samples=34400,samples_per_combination=800,feature_dim=128,sample_time_s=1,checkpoint_iteration=5000,checkpoint_sha256=report['checkpoint_sha256'],projection='Joint PCA 50D + t-SNE 2D',perplexity=30,random_seed=42,iterations=2000,original_coordinates_preserved=False,coordinates_shared_across_layers=True,ur5e_known_hand_setup='Reference-pose initialization',source_embedding_sha256=hashlib.sha256((source/'analysis/embedding.npz').read_bytes()).hexdigest()))
(root/'new-embodiments.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print('Exported 43 groups / 34,400 points. Only rounded to 4 decimals; no projection refit.')
