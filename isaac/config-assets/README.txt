Configuration cards: 4 arms, 13 hands/grippers, 27 objects.
Native visual meshes and recorded initial link transforms from the Isaac replay catalogues.
Arms and hands are rendered separately; hand views use anatomical landmarks with per-hand dorsal-side camera choices.
Mitsuba 3 CPU renderer. Arm/hand images: 192 samples; object images: 48 samples. 420 x 420 pixels.
Reproduction: website/render_config_assets.py. No runtime thumbnail rendering required.
Gripper cards (hand-franka_hand/robotiq/xarm_g1/umi.png), 2026-11-16: Blender re-render in the paper teaser appearance
(vendor colours; UMI with WSG-50 housing and red Fin-Ray fingers), first recorded state, jaws up.
Reproduction: DexFormer2.0/figures/render_gripper_cards.py + finish step (rotate -90 deg, composite on white, 420 px).
