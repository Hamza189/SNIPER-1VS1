"""Equipo LINCE: paneles cosidos con cantos biselados, sin el aspecto de cojín de rev03.
Geometría original en metros; reutiliza los rayos y pesos de la entrega anterior.
"""
import numpy as np


def panel(S, center, right, up, w, h, offset, depth, corner=.16, bevel=.002):
    """Pieza de tejido tenso: frente plano, ocho esquinas y bucles de soporte para subdivisión."""
    c=np.asarray(center,float); r=np.asarray(right,float); r/=np.linalg.norm(r)
    u=np.asarray(up,float); u/=np.linalg.norm(u); n=np.cross(r,u); n/=np.linalg.norm(n)
    hit=S.hit(c+n*.4,-n)
    if hit: c=hit[0]
    outline=np.array([[-1+corner,-1],[1-corner,-1],[1,-1+corner],[1,1-corner],
                      [1-corner,1],[-1+corner,1],[-1,1-corner],[-1,-1+corner]])
    # offset = frente desde la ropa; la espalda penetra ligeramente para evitar costuras abiertas.
    P=[]
    for shrink,z in [(0,offset-depth),(0,offset-bevel),(bevel,offset),(bevel*2,offset)]:
        for x,y in outline:
            P.append(c+r*x*(w/2-shrink)+u*y*(h/2-shrink)+n*z)
    F=[]
    for j in range(3):
        for i in range(8):
            a=j*8+i;b=j*8+(i+1)%8;F.append([a,b,b+8,a+8])
    F.append(list(range(7,-1,-1)));F.append(list(range(24,32)))
    return np.array(P),F


def carrier(S,B,X,Y,Z,box,tube):
    # Placas con recortes trapezoidales; nada de grandes bloques redondos.
    for center,r,w,h,off,depth in [([0,1.225,.1],X,.29,.31,.029,.023),
                                 ([0,1.195,-.1],-X,.24,.25,.007,.011)]:
        P,F=panel(S,center,r,Y,w,h,off,depth,corner=.30);B.add(P,F,21)
    for x in [-.078,0,.078]:
        P,F=panel(S,[x,1.132,.1],X,Y,.068,.127,.057,.026,corner=.12);B.add(P,F,22)
        P,F=panel(S,[x,1.179,.1],X,Y,.064,.028,.060,.005,corner=.18,bevel=.001);B.add(P,F,25)
        # lengüeta vertical de apertura, estrecha y de otro tejido
        P,F=panel(S,[x,1.156,.1],X,Y,.015,.037,.062,.004,corner=.15,bevel=.001);B.add(P,F,26)
    # identificación original LINCE: una franja mostaza y emblema geométrico se pintan sobre este panel
    P,F=panel(S,[0,1.322,.1],X,Y,.108,.044,.034,.005,corner=.12,bevel=.001);B.add(P,F,27)
    # Dos hebillas de ajuste, con su ranura en la textura (no metal brillante en el nylon).
    for s in [-1,1]:
        P,F=panel(S,[s*.10,1.365,.1],X,Y,.025,.036,.029,.007,corner=.12,bevel=.0015);B.add(P,F,26)
    # radio colocada sobre la faja, con dos controles y cable sujeto al hombro
    P,F=panel(S,[.155,1.10,.01],[0,0,-1],Y,.046,.096,.022,.02,corner=.12);B.add(P,F,26)
    P,F=box([.18,1.17,-.005],[.007,.06,.007]);B.add(P,F,26)


def boot_details(C,G,B,tube):
    # Cordones reales sobre la caña. Los límites se calculan sobre las botas ya construidas.
    P=np.asarray(B.P); ids=set()
    for f,part in zip(B.F,B.part):
        if part==18: ids.update(f)
    boots=P[list(ids)]
    for s,sd in [(1,'l'),(-1,'r')]:
        foot=boots[boots[:,0]*s>0]
        for j in range(5):
            y=.10+j*.019
            band=foot[np.abs(foot[:,1]-y)<.014]
            if not len(band):continue
            cx=(band[:,0].max()+band[:,0].min())/2
            z=np.percentile(band[:,2],90)+.002
            for sign in [-1,1]:
                P,F=tube([[cx-.016,y,z],[cx,y+.007*sign,z+.002],[cx+.016,y+.014*sign,z]],.0016,5)
                B.add(P,F,28)
