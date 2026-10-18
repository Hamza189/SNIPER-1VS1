from pathlib import Path
import trimesh, vtk, numpy as np
from PIL import Image
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray
ROOT=Path(__file__).resolve().parents[1]
scene=trimesh.load(ROOT/'models/sd_casa_atlas_1v1.glb',force='scene')
colors={
 'floor_oak':(0.65,0.43,0.27),'floor_concrete':(.52,.53,.52),'floor_tile':(.69,.68,.63),
 'wall_plaster':(.86,.82,.74),'wall_accent':(.68,.60,.49),'wall_tile':(.73,.72,.66),
 'trim_white':(.92,.89,.84),'wood_dark':(.31,.22,.16),'wood_warm':(.56,.35,.22),
 'metal_dark':(.12,.14,.17),'steel':(.50,.53,.56),'glass':(.56,.79,.85),
 'counter_stone':(.80,.77,.72),'sofa_fabric':(.42,.50,.47),'sofa_light':(.76,.70,.62),
 'soft_cloth':(.78,.68,.52),'bed_linen':(.91,.89,.86),'black':(.08,.09,.11),
 'green_leaf':(.23,.44,.24),'terracotta':(.59,.32,.21),'gold':(.80,.62,.29),
 'light_glow':(.98,.89,.58),'screen':(.20,.41,.52), 'bath_white':(.91,.90,.87),
 'rug':(.68,.53,.41),'balcony_stone':(.65,.64,.60)}

def make_actor(mesh,name):
    points=vtk.vtkPoints();points.SetData(numpy_to_vtk(mesh.vertices.astype('float32'),deep=True))
    faces=np.column_stack([np.full(len(mesh.faces),3),mesh.faces]).astype(np.int64)
    cell_array=vtk.vtkCellArray();cell_array.SetCells(len(mesh.faces),numpy_to_vtkIdTypeArray(faces.ravel(),deep=True))
    poly=vtk.vtkPolyData();poly.SetPoints(points);poly.SetPolys(cell_array)
    if mesh.visual.uv is not None:
        uv=numpy_to_vtk(mesh.visual.uv.astype('float32'),deep=True);uv.SetNumberOfComponents(2);poly.GetPointData().SetTCoords(uv)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
    actor=vtk.vtkActor(); actor.SetMapper(mapper)
    color_key=name.split('__')[-1]; c=colors.get(color_key,(.6,.6,.6)); actor.GetProperty().SetColor(c)
    actor.GetProperty().SetAmbient(.25);actor.GetProperty().SetDiffuse(.75)
    actor.GetProperty().SetSpecular(.12);actor.GetProperty().SetSpecularPower(16)
    im = getattr(mesh.visual.material, 'baseColorTexture', None)
    if im is not None:
        ar=np.asarray(im.convert('RGB'))[::-1,:,:].copy()
        tex_im=vtk.vtkImageData();tex_im.SetDimensions(im.width,im.height,1);tex_im.AllocateScalars(vtk.VTK_UNSIGNED_CHAR,3)
        tex_im.GetPointData().GetScalars().DeepCopy(numpy_to_vtk(ar.reshape(-1,3),deep=True,array_type=vtk.VTK_UNSIGNED_CHAR))
        tex=vtk.vtkTexture();tex.SetInputData(tex_im);tex.RepeatOn();tex.InterpolateOn();actor.SetTexture(tex)
        actor.GetProperty().SetColor(1,1,1)
    if color_key=='glass':actor.GetProperty().SetOpacity(.19)
    return actor

ren=vtk.vtkRenderer();ren.SetBackground(.73,.79,.83);ren.UseFXAAOff()
for name,mesh in scene.geometry.items():ren.AddActor(make_actor(mesh,name))
for pos,intens in [((1,25,-8),.95),((-10,17,13),.6)]:
 l=vtk.vtkLight();l.SetPosition(*pos);l.SetFocalPoint(0,0,0);l.SetIntensity(intens);l.SetLightTypeToSceneLight();ren.AddLight(l)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(ren);win.SetSize(1400,1000);win.SetMultiSamples(8)
cam=ren.GetActiveCamera();cam.ParallelProjectionOn();cam.SetParallelScale(10.4)
angles={
 'vista_isometrica':((22,22,24),(0,0,.3),(.0,1,0)),
 'vista_planta':((0,24,0),(0,0,0),(0,0,-1)),
 'vista_fachada_y_balcon':((-3,7,22),(0,0,0),(0,1,0)),
 'vista_interior':((4.3,4.6,8.5),(-.3,.8,-1.3),(0,1,0)),
}
for name,(position,focus,up) in angles.items():
 cam.SetPosition(*position); cam.SetFocalPoint(*focus);cam.SetViewUp(*up);cam.OrthogonalizeViewUp()
 ren.ResetCameraClippingRange()
 win.Render()
 window_to_image=vtk.vtkWindowToImageFilter();window_to_image.SetInput(win);window_to_image.SetInputBufferTypeToRGB();window_to_image.ReadFrontBufferOff();window_to_image.Update()
 wr=vtk.vtkPNGWriter();wr.SetFileName(str(ROOT/'preview'/f'{name}.png'));wr.SetInputConnection(window_to_image.GetOutputPort());wr.Write()
 print('saved', name)
