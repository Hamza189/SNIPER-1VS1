"""Confección LINCE: distancias a costuras y paneles en metros, nunca ruido a tamaño arbitrario."""
import numpy as np


def details(pos, part, M, J):
    x,y,z=pos[...,0],pos[...,1],pos[...,2]
    seam=np.zeros_like(x); reinforcement=np.zeros_like(x); piping=np.zeros_like(x)
    def line(d,width=.0010):return np.clip(1-np.abs(d)/width,0,1)
    # Pespunte doble de portacargadores. 7,8 cm entre centros: mismo contrato que tailored.py.
    u=np.abs((x+.039)%.078-.039)
    pouch=(part==22)&(z>.025)
    pd=np.minimum(np.abs(u-.028),np.minimum(np.abs(y-1.074),np.abs(y-1.189)))
    seam=np.maximum(seam,line(pd)*pouch)
    seam=np.maximum(seam,line(u-.024)*pouch*.7)
    # Solapas, doble fila por el borde inferior.
    seam=np.maximum(seam,(line(y-1.169)+line(y-1.173))*(part==25))
    # Placa con pecho recortado, contorno cosido y borde de cinta, en su propio sistema local.
    front=(part==21)&(z>0)
    back=(part==21)&(z<=0)
    w=np.where(front,.145,.12); hh=np.where(front,.155,.125); cy=np.where(front,1.225,1.195)
    a=np.abs(x);b=np.abs(y-cy)
    d=np.minimum(w-a,hh-b)
    d=np.minimum(d,((w+hh)*.84-a-b)/1.414)
    seam=np.maximum(seam,(line(d-.006)+.7*line(d-.010))*(front|back))
    piping=np.maximum(piping,np.clip(1-d/.004,0,1)*(front|back))
    # Paneles articulados en mangas: costura a lo largo del brazo, refuerzo de codo, velcro del puño.
    for s,sd in [(1,'l'),(-1,'r')]:
        sh,el,wr=(J[sd+k] for k in ['-shoulder','-elbow','-hand'])
        axis=wr-el;length=np.linalg.norm(axis);axis/=length
        delta=pos-el;t=delta@axis
        radial=delta-t[...,None]*axis
        az=np.arctan2(radial[...,2],radial[...,0]*s)
        arm=M('jacket')&(x*s>.16)&(y>1.0)
        ep=((t+.015)/.065)**2+((az+.35)/1.45)**2
        reinforcement=np.maximum(reinforcement,arm*np.clip((1-ep)*8,0,1))
        seam=np.maximum(seam,arm*line(ep-1,.045))
        seam=np.maximum(seam,arm*line(t-length*.78))
        # Doble puntada lateral del pantalón y refuerzo frontal de la rodilla.
        kn=J[sd+'-knee'];leg=M('pants')&(x*s>0)
        ld=np.abs(x-kn[0]);kp=((y-kn[1])/.10)**2+(ld/.065)**2
        reinforcement=np.maximum(reinforcement,leg*(z>kn[2])*np.clip((1-kp)*6,0,1)*.7)
        seam=np.maximum(seam,leg*(z>kn[2])*line(kp-1,.045))
    # Identificación propia: chevrón partido y franja mostaza, sin logotipos externos.
    label=part==27
    logo=label&(np.abs((y-1.322)-np.abs(x)*.65)<.002)&(np.abs(x)<.019)
    bars=label&(x<-.035)&(x>-.043)
    # Tejido ripstop de 6 mm. Costuras discontinuas de 3,2 mm; valores pequeños para evitar moiré.
    grid=(line((x+.003)%.006-.003,.0003)+line((y+.003)%.006-.003,.0003))*.5
    stitch=seam*(np.sin((x+y+z)*np.pi*2/.0032)>-.15)
    return dict(seam=seam,stitch=stitch,reinforcement=reinforcement,piping=piping,
                logo=logo,bars=bars,grid=grid)
